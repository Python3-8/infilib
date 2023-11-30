import { logout } from '$lib/auth.js';
import { redirect } from '@sveltejs/kit';
import { serverResponse } from '$lib/serverHelpers.js';

export async function GET() {
	console.log('In');
	await serverResponse(logout);
	throw redirect(303, '/');
}