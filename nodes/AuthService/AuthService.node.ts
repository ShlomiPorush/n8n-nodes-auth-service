import type {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

export class AuthService implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Auth Service',
		name: 'authService',
		icon: 'file:authservice.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with an Auth Service instance — validate tokens, manage zones and tokens',
		defaults: {
			name: 'Auth Service',
		},
		inputs: ['main'] as any,
		outputs: ['main'] as any,

		credentials: [
			{
				name: 'authServiceApi',
				required: true,
			},
		],

		properties: [
			// ── Operation ──
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Validate Token',
						value: 'validate',
						description: 'Check if a token is valid for a specific zone and permission level',
						action: 'Validate a token',
					},
					{
						name: 'List Zones',
						value: 'listZones',
						description: 'Get all zones (requires zones:read scope)',
						action: 'List zones',
					},
					{
						name: 'Create Zone',
						value: 'createZone',
						description: 'Create a new zone (requires zones:write scope)',
						action: 'Create a zone',
					},
					{
						name: 'List Tokens',
						value: 'listTokens',
						description: 'Get all tokens (requires tokens:read scope)',
						action: 'List tokens',
					},
					{
						name: 'Create Token',
						value: 'createToken',
						description: 'Create a new API token (requires tokens:write scope)',
						action: 'Create a token',
					},
					{
						name: 'Edit Token',
						value: 'editToken',
						description: 'Update an existing token (requires tokens:write scope)',
						action: 'Edit a token',
					},
					{
						name: 'Delete Token',
						value: 'deleteToken',
						description: 'Delete a token (requires tokens:write scope)',
						action: 'Delete a token',
					},
				],
				default: 'validate',
			},

			// ═══════════════════════════════════════
			// VALIDATE OPERATION
			// ═══════════════════════════════════════

			{
				displayName: 'Token',
				name: 'token',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				required: true,
				description: 'The API token to validate',
				displayOptions: { show: { operation: ['validate'] } },
			},
			{
				displayName: 'Zone',
				name: 'zone',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getZones' },
				default: '',
				required: true,
				description: 'The zone (area) to validate the token against',
				displayOptions: { show: { operation: ['validate'] } },
			},
			{
				displayName: 'Permission Level',
				name: 'level',
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
				displayOptions: { show: { operation: ['validate'] } },
			},

			// ═══════════════════════════════════════
			// CREATE ZONE OPERATION
			// ═══════════════════════════════════════

			{
				displayName: 'Zone Name',
				name: 'zoneName',
				type: 'string',
				default: '',
				required: true,
				description: 'Name for the new zone (e.g. "orders", "billing")',
				displayOptions: { show: { operation: ['createZone'] } },
			},
			{
				displayName: 'Description',
				name: 'zoneDescription',
				type: 'string',
				default: '',
				description: 'Optional description for the zone',
				displayOptions: { show: { operation: ['createZone'] } },
			},

			// ═══════════════════════════════════════
			// CREATE TOKEN OPERATION
			// ═══════════════════════════════════════

			{
				displayName: 'Token Name',
				name: 'tokenName',
				type: 'string',
				default: '',
				required: true,
				description: 'Label for the new token',
				displayOptions: { show: { operation: ['createToken'] } },
			},
			{
				displayName: 'Grants',
				name: 'grants',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				required: true,
				description: 'Zone permissions for the token',
				displayOptions: { show: { operation: ['createToken'] } },
				options: [
					{
						name: 'grant',
						displayName: 'Grant',
						values: [
							{
								displayName: 'Zone',
								name: 'area',
								type: 'options',
								typeOptions: { loadOptionsMethod: 'getZones' },
								default: '',
								required: true,
							},
							{
								displayName: 'Level',
								name: 'level',
								type: 'options',
								options: [
									{ name: 'Read', value: 'read' },
									{ name: 'Write', value: 'write' },
									{ name: 'Delete', value: 'delete' },
									{ name: 'All', value: 'all' },
								],
								default: 'read',
								required: true,
							},
						],
					},
				],
			},
			{
				displayName: 'Expires At',
				name: 'expiresAt',
				type: 'dateTime',
				default: '',
				description: 'Optional expiration date (ISO 8601)',
				displayOptions: { show: { operation: ['createToken'] } },
			},

			// ═══════════════════════════════════════
			// EDIT TOKEN OPERATION
			// ═══════════════════════════════════════

			{
				displayName: 'Token ID',
				name: 'tokenId',
				type: 'string',
				default: '',
				required: true,
				description: 'The UUID of the token to edit',
				displayOptions: { show: { operation: ['editToken'] } },
			},
			{
				displayName: 'Name',
				name: 'editName',
				type: 'string',
				default: '',
				description: 'New name for the token (leave empty to keep current)',
				displayOptions: { show: { operation: ['editToken'] } },
			},
			{
				displayName: 'Grants',
				name: 'editGrants',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				description: 'New zone permissions (leave empty to keep current)',
				displayOptions: { show: { operation: ['editToken'] } },
				options: [
					{
						name: 'grant',
						displayName: 'Grant',
						values: [
							{
								displayName: 'Zone',
								name: 'area',
								type: 'options',
								typeOptions: { loadOptionsMethod: 'getZones' },
								default: '',
								required: true,
							},
							{
								displayName: 'Level',
								name: 'level',
								type: 'options',
								options: [
									{ name: 'Read', value: 'read' },
									{ name: 'Write', value: 'write' },
									{ name: 'Delete', value: 'delete' },
									{ name: 'All', value: 'all' },
								],
								default: 'read',
								required: true,
							},
						],
					},
				],
			},
			{
				displayName: 'Active',
				name: 'editIsActive',
				type: 'options',
				options: [
					{ name: 'No Change', value: '' },
					{ name: 'Active', value: 'true' },
					{ name: 'Inactive', value: 'false' },
				],
				default: '',
				description: 'Enable or disable the token',
				displayOptions: { show: { operation: ['editToken'] } },
			},
			{
				displayName: 'Expires At',
				name: 'editExpiresAt',
				type: 'dateTime',
				default: '',
				description: 'New expiration date (leave empty to keep current)',
				displayOptions: { show: { operation: ['editToken'] } },
			},

			// ═══════════════════════════════════════
			// DELETE TOKEN OPERATION
			// ═══════════════════════════════════════

			{
				displayName: 'Token ID',
				name: 'deleteTokenId',
				type: 'string',
				default: '',
				required: true,
				description: 'The UUID of the token to delete',
				displayOptions: { show: { operation: ['deleteToken'] } },
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('authServiceApi');
		const baseUrl = (credentials.baseUrl as string).replace(/\/+$/, '');

		for (let i = 0; i < items.length; i++) {
			const operation = this.getNodeParameter('operation', i) as string;

			try {
				if (operation === 'validate') {
					const token = this.getNodeParameter('token', i) as string;
					const zone = this.getNodeParameter('zone', i) as string;
					const level = this.getNodeParameter('level', i) as string;

					const result = await this.helpers.httpRequest({
						method: 'POST',
						url: `${baseUrl}/validate`,
						body: { token, area: zone, level },
						headers: { 'Content-Type': 'application/json' },
						json: true,
					});

					returnData.push({ json: result as any });

				} else if (operation === 'listZones') {
					const result = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'authServiceApi',
						{
							method: 'GET' as const,
							url: `${baseUrl}/tokens/zones`,
							json: true,
						},
					);

					// Each zone is its own item
					const zones = Array.isArray(result) ? result : [];
					for (const z of zones) {
						returnData.push({ json: z as any });
					}

				} else if (operation === 'createZone') {
					const zoneName = this.getNodeParameter('zoneName', i) as string;
					const zoneDescription = this.getNodeParameter('zoneDescription', i, '') as string;

					const result = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'authServiceApi',
						{
							method: 'POST' as const,
							url: `${baseUrl}/tokens/zones`,
							body: { name: zoneName, description: zoneDescription },
							json: true,
						},
					);

					returnData.push({ json: result as any });

				} else if (operation === 'listTokens') {
					const result = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'authServiceApi',
						{
							method: 'GET' as const,
							url: `${baseUrl}/tokens`,
							json: true,
						},
					);

					const tokens = Array.isArray(result) ? result : [];
					for (const t of tokens) {
						returnData.push({ json: t as any });
					}

				} else if (operation === 'createToken') {
					const tokenName = this.getNodeParameter('tokenName', i) as string;
					const grantsData = this.getNodeParameter('grants', i) as { grant?: Array<{ area: string; level: string }> };
					const expiresAt = this.getNodeParameter('expiresAt', i, '') as string;

					const grants = (grantsData.grant || []).map((g) => ({
						area: g.area,
						level: g.level,
					}));

					const body: Record<string, any> = { name: tokenName, grants };
					if (expiresAt) {
						body.expiresAt = expiresAt;
					}

					const result = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'authServiceApi',
						{
							method: 'POST' as const,
							url: `${baseUrl}/tokens`,
							body,
							json: true,
						},
					);

					returnData.push({ json: result as any });

				} else if (operation === 'editToken') {
					const tokenId = this.getNodeParameter('tokenId', i) as string;
					const body: Record<string, any> = {};

					const editName = this.getNodeParameter('editName', i, '') as string;
					if (editName) body.name = editName;

					const editGrants = this.getNodeParameter('editGrants', i, {}) as { grant?: Array<{ area: string; level: string }> };
					if (editGrants.grant && editGrants.grant.length > 0) {
						body.grants = editGrants.grant.map((g) => ({ area: g.area, level: g.level }));
					}

					const editIsActive = this.getNodeParameter('editIsActive', i, '') as string;
					if (editIsActive === 'true') body.isActive = true;
					if (editIsActive === 'false') body.isActive = false;

					const editExpiresAt = this.getNodeParameter('editExpiresAt', i, '') as string;
					if (editExpiresAt) body.expiresAt = editExpiresAt;

					const result = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'authServiceApi',
						{
							method: 'PATCH' as const,
							url: `${baseUrl}/tokens/${tokenId}`,
							body,
							json: true,
						},
					);

					returnData.push({ json: result as any });

				} else if (operation === 'deleteToken') {
					const tokenId = this.getNodeParameter('deleteTokenId', i) as string;

					const result = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'authServiceApi',
						{
							method: 'DELETE' as const,
							url: `${baseUrl}/tokens/${tokenId}`,
							json: true,
						},
					);

					returnData.push({ json: result as any });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
							operation,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
