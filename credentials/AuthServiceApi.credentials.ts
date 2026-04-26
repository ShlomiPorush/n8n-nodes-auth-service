import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AuthServiceApi implements ICredentialType {
	name = 'authServiceApi';
	displayName = 'Auth Service API';
	documentationUrl = 'https://github.com/ShlomiPorush/auth-master';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'http://localhost:8080',
			placeholder: 'https://auth.example.com',
			description: 'The base URL of your Auth Service instance (no trailing slash)',
			required: true,
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'An API key created in the Auth Service dashboard (API Keys tab) or the ADMIN_API_KEY from environment',
			required: true,
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/tokens/ping',
			method: 'GET',
		},
	};
}
