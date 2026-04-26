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
				isFullPath: true,
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
				description: 'The path to listen on (the full path after /webhook/)',
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
			{
				displayName: 'Token Prefix',
				name: 'tokenPrefix',
				type: 'string',
				default: 'Bearer',
				description: 'Prefix to strip from the header value before extracting the token (e.g. "Bearer"). Leave empty if the header contains the raw token.',
			},

			// ── Response Settings ──
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
				description: 'The HTTP response code to return on success',
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

		// ── Extract token ──
		let token = '';
		let headerVal = '';

		if (tokenSource === 'authHeader') {
			headerVal = (req.headers['authorization'] as string) || '';
		} else if (tokenSource === 'customHeader') {
			const headerName = this.getNodeParameter('customHeaderName') as string;
			headerVal = (req.headers[headerName.toLowerCase()] as string) || '';
		}

		// Strip configured prefix from header value
		const prefix = (this.getNodeParameter('tokenPrefix', '') as string).trim();
		headerVal = headerVal.trim();
		if (prefix && headerVal.toLowerCase().startsWith(prefix.toLowerCase() + ' ')) {
			token = headerVal.slice(prefix.length + 1).trim();
		} else {
			token = headerVal;
		}

		// ── No token → 403 ──
		if (!token) {
			resp.status(403).json({ error: 'Forbidden', message: 'No authentication token provided' });
			return { noWebhookResponse: true };
		}

		// ── Validate token against Auth Service ──
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

		// ── Invalid token → 403 ──
		if (!isValid) {
			resp.status(403).json({ error: 'Forbidden', message: 'Token validation failed' });
			return { noWebhookResponse: true };
		}

		// ── Token valid — pass request data to workflow ──
		const body = this.getBodyData();
		const headers = { ...(this.getHeaderData() as IDataObject) };
		const query = this.getQueryData();

		// Remove the auth header from the output to avoid exposing tokens in plain text
		// (the validated token is available in auth.token)
		if (tokenSource === 'authHeader') {
			delete headers['authorization'];
		} else if (tokenSource === 'customHeader') {
			const headerName = this.getNodeParameter('customHeaderName') as string;
			delete headers[headerName.toLowerCase()];
		}

		return {
			workflowData: [
				[
					{
						json: {
							headers,
							params: req.params,
							query,
							body,
							auth: {
								token,
								zone: authZone,
								level: authLevel,
							},
						} as IDataObject,
					},
				],
			],
		};
	}
}
