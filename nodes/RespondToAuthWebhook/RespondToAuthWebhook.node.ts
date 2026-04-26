import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { consumeResponse } from '../responseStore';

export class RespondToAuthWebhook implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Respond to Auth Webhook',
		name: 'respondToAuthWebhook',
		icon: 'file:respondtoauthwebhook.svg',
		group: ['transform'],
		version: 1,
		description: 'Send a custom HTTP response back to the Auth Webhook caller',
		defaults: { name: 'Respond to Auth Webhook' },
		inputs: ['main'] as any,
		outputs: ['main'] as any,
		properties: [
			{
				displayName: 'Respond With',
				name: 'respondWith',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'All Incoming Items',
						value: 'allIncomingItems',
						description: 'Respond with all input items as JSON array',
					},
					{
						name: 'First Incoming Item',
						value: 'firstIncomingItem',
						description: 'Respond with the first input item as JSON',
					},
					{
						name: 'JSON',
						value: 'json',
						description: 'Respond with a custom JSON body',
					},
					{
						name: 'Text',
						value: 'text',
						description: 'Respond with a text body',
					},
					{
						name: 'No Data',
						value: 'noData',
						description: 'Respond with an empty body',
					},
				],
				default: 'firstIncomingItem',
				description: 'The data to send in the response body',
			},
			{
				displayName: 'Response Body',
				name: 'responseBody',
				type: 'json',
				default: '{}',
				required: true,
				description: 'The JSON body to return',
				displayOptions: { show: { respondWith: ['json'] } },
			},
			{
				displayName: 'Response Body',
				name: 'responseTextBody',
				type: 'string',
				default: '',
				required: true,
				description: 'The text body to return',
				typeOptions: { rows: 3 },
				displayOptions: { show: { respondWith: ['text'] } },
			},
			{
				displayName: 'Response Code',
				name: 'responseCode',
				type: 'number',
				typeOptions: { minValue: 100, maxValue: 599 },
				default: 200,
				description: 'The HTTP status code to return',
			},
			{
				displayName: 'Response Headers',
				name: 'responseHeaders',
				placeholder: 'Add Header',
				description: 'Custom headers to include in the response',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
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
								description: 'Header name',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Header value',
							},
						],
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		// Use the execution ID to find the pending response from Auth Webhook
		const executionId = this.getExecutionId();

		const resp = consumeResponse(executionId);
		if (!resp) {
			throw new Error(
				'No pending Auth Webhook response found. Make sure the Auth Webhook node is set to "Using \'Respond to Auth Webhook\' Node" mode.',
			);
		}

		// ── Build and send response ──
		const respondWith = this.getNodeParameter('respondWith', 0) as string;
		const responseCode = this.getNodeParameter('responseCode', 0) as number;

		// Set custom headers
		const headerParam = this.getNodeParameter('responseHeaders', 0, {}) as {
			entries?: Array<{ name: string; value: string }>;
		};
		if (headerParam.entries) {
			for (const h of headerParam.entries) {
				if (h.name) resp.setHeader(h.name, h.value);
			}
		}

		resp.status(responseCode);

		let responseBody: unknown;
		switch (respondWith) {
			case 'allIncomingItems':
				responseBody = items.map((i) => i.json);
				break;
			case 'firstIncomingItem':
				responseBody = items[0].json;
				break;
			case 'json':
				responseBody = JSON.parse(this.getNodeParameter('responseBody', 0) as string);
				break;
			case 'text':
				resp.setHeader('Content-Type', 'text/plain');
				resp.send(this.getNodeParameter('responseTextBody', 0) as string);
				return [items];
			case 'noData':
				resp.end();
				return [items];
		}

		resp.json(responseBody);
		return [items];
	}
}
