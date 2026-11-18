'use strict';

// Run `npm run build` first: these tests load the compiled node from dist/.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { AuthWebhook } = require('../dist/nodes/AuthWebhook/AuthWebhook.node.js');

// The mocked Auth Service accepts only this token, generated for each run.
const VALID_TOKEN = crypto.randomBytes(24).toString('base64url');

const tempDirs = [];
after(() => {
	for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
});

function makeTempFile(contents) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-webhook-test-'));
	tempDirs.push(dir);
	const filePath = path.join(dir, 'upload.bin');
	fs.writeFileSync(filePath, contents);
	return filePath;
}

/**
 * Builds a minimal IWebhookFunctions stand-in. `contentType` is what n8n sets on
 * the request from the Content-Type header; `body` is what n8n parsed into req.body.
 */
function makeContext({ contentType, body, token = VALID_TOKEN, copyBinaryFile }) {
	const calls = { copyBinaryFile: [], prepareBinaryData: [], status: undefined, json: undefined };
	const req = {
		contentType,
		headers: { authorization: `Bearer ${token}` },
		params: {},
		body,
	};
	const res = {
		status(code) {
			calls.status = code;
			return this;
		},
		json(payload) {
			calls.json = payload;
			return this;
		},
	};
	const parameters = {
		authZone: 'orders',
		authLevel: 'write',
		tokenSource: 'authHeader',
		tokenPrefix: 'Bearer',
	};
	const context = {
		getRequestObject: () => req,
		getResponseObject: () => res,
		getCredentials: async () => ({ baseUrl: 'http://auth.test/' }),
		getNodeParameter: (name, fallback) => (name in parameters ? parameters[name] : fallback),
		getBodyData: () => req.body,
		getHeaderData: () => ({ ...req.headers }),
		getQueryData: () => ({}),
		helpers: {
			httpRequest: async (options) => ({ result: options.body.token === VALID_TOKEN }),
			prepareBinaryData: async (...args) => {
				calls.prepareBinaryData.push(args);
				return { data: '', mimeType: 'application/octet-stream' };
			},
		},
		nodeHelpers: {
			copyBinaryFile: async (filePath, fileName, mimeType) => {
				calls.copyBinaryFile.push([filePath, fileName, mimeType]);
				if (copyBinaryFile) return await copyBinaryFile(filePath, fileName, mimeType);
				return { data: '', id: `stored:${fileName}`, fileName, mimeType };
			},
		},
	};
	return { context, calls };
}

async function run(options) {
	const { context, calls } = makeContext(options);
	const result = await new AuthWebhook().webhook.call(context);
	return { result, calls, item: result.workflowData?.[0]?.[0] };
}

function parserFile(filePath, originalFilename, mimetype) {
	return { filepath: filePath, originalFilename, newFilename: 'abc123', mimetype, size: 1 };
}

// ── Non-multipart bodies never cause a file read ──

test('JSON body with top-level files keeps them as data and reads nothing', async () => {
	const sentinel = makeTempFile('host secret');
	const body = { files: { x: { filepath: sentinel } } };
	const { item, calls } = await run({ contentType: 'application/json', body });

	assert.equal(item.binary, undefined);
	assert.deepEqual(item.json.body, { files: { x: { filepath: sentinel } } });
	assert.equal(calls.copyBinaryFile.length, 0);
	assert.equal(calls.prepareBinaryData.length, 0);
});

test('JSON body with data and top-level files keeps the existing flattening and reads nothing', async () => {
	const sentinel = makeTempFile('host secret');
	const body = { data: { a: 1 }, files: { x: { filepath: sentinel } } };
	const { item, calls } = await run({ contentType: 'application/json', body });

	assert.equal(item.binary, undefined);
	assert.deepEqual(item.json.body, { a: 1, files: { x: { filepath: sentinel } } });
	assert.equal(calls.copyBinaryFile.length, 0);
	assert.equal(calls.prepareBinaryData.length, 0);
});

test('JSON body with data.files only keeps it as data and reads nothing', async () => {
	const sentinel = makeTempFile('host secret');
	const body = { data: { files: { x: { filepath: sentinel } } } };
	const { item, calls } = await run({ contentType: 'application/json', body });

	assert.equal(item.binary, undefined);
	assert.deepEqual(item.json.body, { files: { x: { filepath: sentinel } } });
	assert.equal(calls.copyBinaryFile.length, 0);
	assert.equal(calls.prepareBinaryData.length, 0);
});

test('form-urlencoded and missing content types read nothing', async () => {
	const sentinel = makeTempFile('host secret');
	for (const contentType of ['application/x-www-form-urlencoded', undefined]) {
		const body = { files: { x: { filepath: sentinel } } };
		const { item, calls } = await run({ contentType, body });
		assert.equal(item.binary, undefined, String(contentType));
		assert.equal(calls.copyBinaryFile.length, 0, String(contentType));
		assert.equal(calls.prepareBinaryData.length, 0, String(contentType));
	}
});

// ── Multipart bodies parsed by n8n ──

test('multipart upload is stored through n8n and body holds only the form fields', async () => {
	const upload = makeTempFile('pdf bytes');
	const body = {
		data: { name: 'report' },
		files: { doc: parserFile(upload, 'report.pdf', 'application/pdf') },
	};
	const { item, calls } = await run({ contentType: 'multipart/form-data', body });

	assert.deepEqual(calls.copyBinaryFile, [[upload, 'report.pdf', 'application/pdf']]);
	assert.equal(calls.prepareBinaryData.length, 0);
	assert.deepEqual(Object.keys(item.binary), ['doc']);
	assert.equal(item.binary.doc.id, 'stored:report.pdf');
	assert.deepEqual(item.json.body, { name: 'report' });
});

test('multipart with several files in one field names them <field>_<index>', async () => {
	const first = makeTempFile('one');
	const second = makeTempFile('two');
	const body = {
		data: {},
		files: {
			docs: [parserFile(first, 'a.txt', 'text/plain'), parserFile(second, 'b.txt', 'text/plain')],
		},
	};
	const { item } = await run({ contentType: 'multipart/form-data', body });

	assert.deepEqual(Object.keys(item.binary), ['docs_0', 'docs_1']);
});

test('multipart field name that is only whitespace falls back to data', async () => {
	const upload = makeTempFile('bytes');
	const body = { data: {}, files: { '  ': parserFile(upload, 'a.txt', 'text/plain') } };
	const { item } = await run({ contentType: 'multipart/form-data', body });

	assert.deepEqual(Object.keys(item.binary), ['data']);
});

test('multipart text field named files stays in the body', async () => {
	const upload = makeTempFile('bytes');
	const body = {
		data: { files: 'just text' },
		files: { doc: parserFile(upload, 'a.txt', 'text/plain') },
	};
	const { item } = await run({ contentType: 'multipart/form-data', body });

	assert.deepEqual(item.json.body, { files: 'just text' });
	assert.deepEqual(Object.keys(item.binary), ['doc']);
});

test('multipart with fields only has no binary and no files key', async () => {
	const body = { data: { a: '1' }, files: {} };
	const { item, calls } = await run({ contentType: 'multipart/form-data', body });

	assert.equal(item.binary, undefined);
	assert.deepEqual(item.json.body, { a: '1' });
	assert.equal(calls.copyBinaryFile.length, 0);
});

test('multipart that n8n did not parse (Binary Data option on) outputs an empty body', async () => {
	const { item, calls } = await run({ contentType: 'multipart/form-data', body: undefined });

	assert.equal(item.binary, undefined);
	assert.deepEqual(item.json.body, {});
	assert.equal(calls.copyBinaryFile.length, 0);
});

test('a failed copy rejects the request without partial output', async () => {
	const first = makeTempFile('one');
	const second = makeTempFile('two');
	const body = {
		data: {},
		files: { a: parserFile(first, 'a.txt', 'text/plain'), b: parserFile(second, 'b.txt', 'text/plain') },
	};
	let count = 0;
	const { context } = makeContext({
		contentType: 'multipart/form-data',
		body,
		copyBinaryFile: async (filePath, fileName) => {
			count++;
			if (count === 2) throw new Error('storage failed');
			return { data: '', id: `stored:${fileName}` };
		},
	});

	await assert.rejects(new AuthWebhook().webhook.call(context), /storage failed/);
});

// ── Token checks happen before any file handling ──

test('invalid token returns 403 and stores no file', async () => {
	const upload = makeTempFile('bytes');
	const body = { data: {}, files: { doc: parserFile(upload, 'a.txt', 'text/plain') } };
	const { result, calls } = await run({ contentType: 'multipart/form-data', body, token: 'wrong' });

	assert.equal(calls.status, 403);
	assert.deepEqual(result, { noWebhookResponse: true });
	assert.equal(calls.copyBinaryFile.length, 0);
	assert.equal(calls.prepareBinaryData.length, 0);
});
