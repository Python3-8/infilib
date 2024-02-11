import { fail } from '@sveltejs/kit';
import { response } from '$lib/serverHelpers.js';
import Papa from 'papaparse';
import { item, user } from '$lib/db.js';

async function importItem(row, library_slug) {
	let created = [];
	try {
		// Split values separated by slash and trim whitespace
		const authors = row['Author'].split('/').map((author) => author.trim());
		const categories = row['Subject'].split('/').map((category) => category.trim());
		const languages = row['Medium'].split('/').map((language) => language.trim());

		await item.create({
			data: {
				library: { connect: { slug: library_slug } },
				status: 'IN',
				acc_no: +row['Acc. No.'],
				title: row['Title of the Book'],
				reference: row['Ref'] === 'Ref', // Assuming 'Ref' is a boolean field
				no_of_pages: +row['Pages'],
				call_no: +row['Call no.'],
				level: row['Level'],
				publisher: {
					connectOrCreate: {
						where: { library_slug_name: { library_slug, name: row["Publisher's Name"] } },
						create: { library_slug, name: row["Publisher's Name"] }
					}
				},
				purchase_details: row['Purchase Details'],
				purchase_price: +row['Price'],
				remarks: row['Remarks'],
				languages: {
					connectOrCreate: languages.map((lang) => ({
						where: { name: lang },
						create: { name: lang }
					}))
				},
				categories: {
					connectOrCreate: categories.map((name) => ({
						where: { library_slug_name: { library_slug, name } },
						create: { library_slug, name }
					}))
				},
				book: {
					create: {
						subtitle: row['SubTitle'],
						authors: {
							connectOrCreate: authors.map((author) => ({
								where: { library_slug_name: { library_slug, name: author } },
								create: { library_slug, name: author }
							}))
						},
						edition: row['Edition/Year'],
						isbn: `${row['ISBN No.']}`
					}
				}
			}
		});
		created.push(+row['Acc. No.']);
	} catch (error) {
		console.error(`We couldn't create the item with accession number: ${row['Acc. No.']}.`);
	}
	return created;
}

async function importUser(row) {
	const {
		Name: name,
		"Email address": email_address,
		Gender: gender,
		"Phone number": phone_number,
		"Date of birth": date_of_birth,
	} = row;
	try {
		await user.create({ data: { name, email_address, gender, phone_number, date_of_birth } });
	} catch (e) {
		console.error(`Couldn't create the user ${email_address} due to the following error ${e}`);
	}
}

export const actions = {
	default: async ({ request, params }) => {
		return response(async () => {
			const { importType, importFile } = Object.fromEntries(await request.formData());
			if (!importType || !["i", "u"].contains(importType)) {
				return fail(400, { incorrect: true, message: 'Import type not provided or invalid' });
			}
			if (!importFile?.name || importFile.name === 'undefined') {
				return fail(400, {
					incorrect: true,
					message: 'You must provide a file to upload'
				});
			}
			let buffer = new Buffer(await importFile.arrayBuffer());
			Papa.parse(buffer.toString(), {
				header: true,
				transformHeader: (str) => str.trim(),
				dynamicTyping: true,
				step: importType === "i" ? async function ({ data, errors }, _parser) {
					await importItem(data, params.library);
					if (errors.length) console.log('Row errors:', errors);
				} : async function ({ data, errors }, _parser) {
					await importUser(data);
					if (errors.length) console.log('Row errors:', errors);
				},
			});
		});
	}
};
