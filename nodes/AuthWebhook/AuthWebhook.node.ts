import type {
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	INodePropertyOptions,
	ILoadOptionsFunctions,
	IDataObject,
} from 'n8n-workflow';

export class AuthWebhook implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Auth Webhook',
		name: 'authWebhook',
		icon: 'file:authwebhook.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["httpMethod"]}} {{$parameter["path"]}}',
		description: 'Webhook trigger with built-in Auth Service token validation — replaces Webhook + Auth Service + IF',
		defaults: {
			name: 'Auth Webhook',
		},
		inputs: [] as any,
		outputs: ['main'] as any,

		credentials: [
			{
				name: 'authServiceApi',
				required: true,
			},
		],

		webhooks: [
			{
				name: 'default',
				httpMethod: '={{$parameter["httpMethod"] || "POST"}}',
				responseMode: '={{$parameter["responseMode"]}}',
				path: '={{$parameter["path"]}}',
				isFullPath: false,
			},
		],

		properties: [
			// ═══════════════════════════════════════
			// WEBHOOK SETTINGS (mirroring built-in)
			// ═══════════════════════════════════════

			{
				displayName: 'HTTP Method',
				name: 'httpMethod',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'DELETE', value: 'DELETE' },
					{ name: 'GET', value: 'GET' },
					{ name: 'HEAD', value: 'HEAD' },
					{ name: 'PATCH', value: 'PATCH' },
					{ name: 'POST', value: 'POST' },
					{ name: 'PUT', value: 'PUT' },
				],
				default: 'POST',
				description: 'The HTTP method to listen to',
			},
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'webhook-path',
				description: 'The path to listen on',
			},

			// ═══════════════════════════════════════
			// AUTH SETTINGS
			// ═══════════════════════════════════════

			{
				displayName: 'Auth Zone',
				name: 'authZone',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getZones' },
				default: '',
				required: true,
				description: 'The zone to validate the incoming token against',
			},
			{
				displayName: 'Auth Level',
				name: 'authLevel',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Read', value: 'read' },
					{ name: 'Write', value: 'write' },
					{ name: 'Delete', value: 'delete' },
					{ name: 'All', value: 'all' },
				],
				default: 'read',
				required: true,
				description: 'The minimum permission level required',
			},
			{
				displayName: 'Token Source',
				name: 'tokenSource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Authorization Header (Bearer)',
						value: 'authHeader',
						description: 'Extract from the Authorization: Bearer <token> header',
					},
					{
						name: 'Custom Header',
						value: 'customHeader',
						description: 'Extract from a custom request header',
					},
				],
				default: 'authHeader',
				description: 'Where to find the authentication token in the request',
			},
			{
				displayName: 'Header Name',
				name: 'customHeaderName',
				type: 'string',
				default: 'X-Auth-Token',
				required: true,
				description: 'The name of the header containing the token',
				displayOptions: { show: { tokenSource: ['customHeader'] } },
			},

			// ═══════════════════════════════════════
			// RESPONSE SETTINGS (mirroring built-in)
			// ═══════════════════════════════════════

			{
				displayName: 'Respond',
				name: 'responseMode',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Immediately',
						value: 'onReceived',
						description: 'As soon as this node executes',
					},
					{
						name: 'When Last Node Finishes',
						value: 'lastNode',
						description: 'Returns data of the last-executed node',
					},
				],
				default: 'onReceived',
				description: 'When and how to respond to the webhook',
			},
			{
				displayName: 'Response Code',
				name: 'responseCode',
				type: 'number',
				typeOptions: {
					minValue: 100,
					maxValue: 599,
				},
				default: 200,
				description: 'The HTTP Response code to return',
			},
			{
				displayName: 'Response Data',
				name: 'responseData',
				type: 'options',
				displayOptions: {
					show: {
						responseMode: ['lastNode'],
					},
				},
				options: [
					{
						name: 'All Entries',
						value: 'allEntries',
						description: 'Returns all the entries of the last node. Always returns an array.',
					},
					{
						name: 'First Entry JSON',
						value: 'firstEntryJson',
						description: 'Returns the JSON data of the first entry of the last node. Always returns a JSON object.',
					},
					{
						name: 'First Entry Binary',
						value: 'firstEntryBinary',
						description: 'Returns the binary data of the first entry of the last node. Always returns a binary file.',
					},
					{
						name: 'No Response Body',
						value: 'noData',
						description: 'Returns without a body',
					},
				],
				default: 'firstEntryJson',
				description: 'What data should be returned. If it should return all items as an array or only the first item as object.',
			},
			{
				displayName: 'Property Name',
				name: 'responseBinaryPropertyName',
				type: 'string',
				required: true,
				default: 'data',
				displayOptions: {
					show: {
						responseData: ['firstEntryBinary'],
					},
				},
				description: 'Name of the binary property to return',
			},

			// ═══════════════════════════════════════
			// OPTIONS (mirroring built-in)
			// ═══════════════════════════════════════

			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Field Name for Binary Data',
						name: 'binaryPropertyName',
						type: 'string',
						default: 'data',
						description: 'The name of the output field to put any binary file data in',
					},
					{
						displayName: 'Ignore Bots',
						name: 'ignoreBots',
						type: 'boolean',
						default: false,
						description: 'Whether to ignore requests from bots like link previewers and web crawlers',
					},
					{
						displayName: 'IP(s) Allowlist',
						name: 'ipWhitelist',
						type: 'string',
						placeholder: 'e.g. 127.0.0.1, 192.168.1.0/24',
						default: '',
						description: 'Comma-separated list of allowed IP addresses. Leave empty to allow all IPs.',
					},
					{
						displayName: 'No Response Body',
						name: 'noResponseBody',
						type: 'boolean',
						default: false,
						description: 'Whether to send any body in the response',
						displayOptions: {
							show: {
								'/responseMode': ['onReceived'],
							},
						},
					},
					{
						displayName: 'Raw Body',
						name: 'rawBody',
						type: 'boolean',
						default: false,
						description: 'Whether to return the raw body',
					},
					{
						displayName: 'Response Data',
						name: 'responseData',
						type: 'string',
						displayOptions: {
							show: {
								'/responseMode': ['onReceived'],
							},
							hide: {
								noResponseBody: [true],
							},
						},
						default: '',
						placeholder: 'success',
						description: 'Custom response data to send',
					},
					{
						displayName: 'Response Content-Type',
						name: 'responseContentType',
						type: 'string',
						displayOptions: {
							show: {
								'/responseData': ['firstEntryJson'],
								'/responseMode': ['lastNode'],
							},
						},
						default: '',
						placeholder: 'application/xml',
						description: 'Set a custom content-type to return if another one as the "application/json" should be returned',
					},
					{
						displayName: 'Response Headers',
						name: 'responseHeaders',
						placeholder: 'Add Response Header',
						description: 'Add headers to the webhook response',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						options: [
							{
								name: 'entries',
								displayName: 'Entries',
								values: [
									{
										displayName: 'Name',
										name: 'name',
										type: 'string',
										default: '',
										description: 'Name of the header',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description: 'Value of the header',
									},
								],
							},
						],
					},
					{
						displayName: 'Property Name',
						name: 'responsePropertyName',
						type: 'string',
						displayOptions: {
							show: {
								'/responseData': ['firstEntryJson'],
								'/responseMode': ['lastNode'],
							},
						},
						default: 'data',
						description: 'Name of the property to return the data of instead of the whole JSON',
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getZones(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('authServiceApi');
				const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');

				try {
					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'authServiceApi',
						{
							method: 'GET' as const,
							url: `${baseUrl}/tokens/zones`,
							json: true,
						},
					);

					const zones = Array.isArray(response) ? response : [];
					return zones.map((z: { name: string }) => ({
						name: z.name,
						value: z.name,
					}));
				} catch {
					return [{ name: '(Could not load zones \u2014 check credentials)', value: '' }];
				}
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const resp = this.getResponseObject();
		const credentials = await this.getCredentials('authServiceApi');
		const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');
		const authZone = this.getNodeParameter('authZone') as string;
		const authLevel = this.getNodeParameter('authLevel') as string;
		const tokenSource = this.getNodeParameter('tokenSource') as string;
		const options = this.getNodeParameter('options', {}) as IDataObject;

		// ── Extract token ──
		let token = '';
		if (tokenSource === 'authHeader') {
			const authHeader = req.headers['authorization'] || '';
			if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
				token = authHeader.slice(7).trim();
			}
		} else if (tokenSource === 'customHeader') {
			const headerName = this.getNodeParameter('customHeaderName') as string;
			const headerVal = req.headers[headerName.toLowerCase()];
			if (headerVal) {
				token = typeof headerVal === 'string' ? headerVal : String(headerVal);
			}
		}

		// ── Validate token against Auth Service ──
		if (!token) {
			resp.status(403).json({ error: 'Forbidden', message: 'No authentication token provided' });
			return { noWebhookResponse: true };
		}

		let isValid = false;
		try {
			const validateResult = await this.helpers.httpRequest({
				method: 'POST',
				url: `${baseUrl}/validate`,
				body: { token, area: authZone, level: authLevel },
				headers: { 'Content-Type': 'application/json' },
				json: true,
			}) as { result: boolean };

			isValid = validateResult?.result === true;
		} catch {
			isValid = false;
		}

		if (!isValid) {
			resp.status(403).json({ error: 'Forbidden', message: 'Token validation failed' });
			return { noWebhookResponse: true };
		}

		// ── Token valid — build output identical to built-in Webhook node ──
		const body = this.getBodyData();
		const headers = this.getHeaderData();
		const query = this.getQueryData();

		const returnItem: IDataObject = {
			headers,
			params: req.params,
			query,
			body,
		};

		// Handle binary data
		if (req.contentType !== 'multipart/form-data' && options.rawBody) {
			returnItem.rawBody = (req as any).rawBody;
		}

		// File uploads
		if (req.files && Object.keys(req.files as object).length > 0) {
			returnItem.files = req.files as any;
		}

		return {
			workflowData: [
				[{ json: returnItem }],
			],
		};
	}
}
