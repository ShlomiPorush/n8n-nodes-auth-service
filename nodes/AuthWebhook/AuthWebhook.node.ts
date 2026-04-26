import type {
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	INodePropertyOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

export class AuthWebhook implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Auth Webhook',
		name: 'authWebhook',
		icon: 'file:authwebhook.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["httpMethod"]}} {{$parameter["path"]}}',
		description: 'Webhook trigger with built-in Auth Service token validation',
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
				httpMethod: '={{$parameter["httpMethod"]}}',
				responseMode: '={{$parameter["responseMode"]}}',
				path: '={{$parameter["path"]}}',
				isFullPath: false,
			},
		],

		properties: [
			// ── Webhook Settings ──
			{
				displayName: 'HTTP Method',
				name: 'httpMethod',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'GET', value: 'GET' },
					{ name: 'POST', value: 'POST' },
					{ name: 'PUT', value: 'PUT' },
					{ name: 'PATCH', value: 'PATCH' },
					{ name: 'DELETE', value: 'DELETE' },
				],
				default: 'POST',
				description: 'The HTTP method to listen on',
			},
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				default: 'auth-webhook',
				required: true,
				placeholder: 'my-webhook-path',
				description: 'The webhook URL path',
			},
			{
				displayName: 'Response Mode',
				name: 'responseMode',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'On Received',
						value: 'onReceived',
						description: 'Respond immediately when the request is received',
					},
					{
						name: 'Using Respond to Webhook Node',
						value: 'responseNode',
						description: 'Wait for a Respond to Webhook node in the workflow',
					},
				],
				default: 'onReceived',
				description: 'When to send the HTTP response',
			},

			// ── Auth Settings ──
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
						name: 'Custom Header / Field',
						value: 'custom',
						description: 'Extract from a custom header or static field',
					},
				],
				default: 'authHeader',
				description: 'Where to find the authentication token in the request',
			},
			{
				displayName: 'Token Header / Value',
				name: 'customTokenField',
				type: 'string',
				default: 'X-Auth-Token',
				required: true,
				description: 'Header name to extract the token from, or a static token value',
				displayOptions: { show: { tokenSource: ['custom'] } },
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
		const credentials = await this.getCredentials('authServiceApi');
		const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');
		const authZone = this.getNodeParameter('authZone') as string;
		const authLevel = this.getNodeParameter('authLevel') as string;
		const tokenSource = this.getNodeParameter('tokenSource') as string;

		// ── Extract token ──
		let token = '';
		if (tokenSource === 'authHeader') {
			const authHeader = req.headers['authorization'] || '';
			if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
				token = authHeader.slice(7).trim();
			}
		} else if (tokenSource === 'custom') {
			const customField = this.getNodeParameter('customTokenField') as string;
			// Try as header first, fall back to using the value directly
			const headerVal = req.headers[customField.toLowerCase()];
			if (headerVal) {
				token = typeof headerVal === 'string' ? headerVal : String(headerVal);
			} else {
				// Use the field value as a static token
				token = customField;
			}
		}

		// ── Validate token ──
		if (!token) {
			return {
				webhookResponse: {
					status: 403,
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ error: 'Forbidden', message: 'No authentication token provided' }),
				},
			};
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
			return {
				webhookResponse: {
					status: 403,
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ error: 'Forbidden', message: 'Token validation failed' }),
				},
			};
		}

		// ── Token valid — pass request data to workflow ──
		const body = this.getBodyData();
		const headers = this.getHeaderData();
		const query = this.getQueryData();

		return {
			workflowData: [
				[
					{
						json: {
							headers,
							params: req.params,
							query,
							body,
						},
					},
				],
			],
		};
	}
}
