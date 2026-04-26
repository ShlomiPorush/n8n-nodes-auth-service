import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';

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
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				options: [
					{
						displayName: 'Response Code',
						name: 'responseCode',
						type: 'number',
						typeOptions: { minValue: 100, maxValue: 599 },
						default: 200,
						description: 'The HTTP status code to return. Defaults to 200.',
					},
					{
						displayName: 'Response Headers',
						name: 'responseHeaders',
						placeholder: 'Add Response Header',
						description: 'Add headers to the webhook response',
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
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const respondWith = this.getNodeParameter('respondWith', 0) as string;
		const options = this.getNodeParameter('options', 0, {}) as IDataObject;

		// Build response headers
		const headers = {} as IDataObject;
		if (options.responseHeaders) {
			for (const header of (options.responseHeaders as IDataObject).entries as IDataObject[]) {
				headers[(header.name as string).toLowerCase()] = header.value;
			}
		}

		const statusCode = (options.responseCode as number) || 200;
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
				responseBody = this.getNodeParameter('responseTextBody', 0) as string;
				break;
			case 'noData':
				responseBody = undefined;
				break;
		}

		// Use n8n's built-in sendResponse() — same mechanism as the official
		// "Respond to Webhook" node. This handles cross-process communication
		// in queue mode automatically.
		(this as any).sendResponse({
			body: responseBody,
			headers,
			statusCode,
		});

		return [items];
	}
}
