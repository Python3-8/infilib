import { item } from '$lib/db.js';
import { pojoData, response } from '$lib/serverHelpers.js';
import { fail } from '@sveltejs/kit';
import { getItemColumns } from '$lib/columns.js';
import { standardizeSelects, flatten } from '$lib/helpers.js';
import { parseProperties } from '$lib/validators.js';

export async function load({ url, params }) {
	const [columns, others] = await getItemColumns();
	let itemColumns = columns;

	let where = { library_slug: params.library };
	let include = {
		publisher: true,
		categories: true,
		languages: true
	};
	let type;
	for (let [key, val] of url.searchParams.entries()) {
		if (key === 'show') {
			if (Object.keys(others).includes(val)) {
				where[val] = { isNot: null };
				include[val] = {
					include: Object.fromEntries(
						others[val].filter(({ type }) => type === 'select').map(({ id }) => [id, true])
					)
				};
				itemColumns = columns.concat(others[val]);
				type = val;
			}
		}
	}

	return {
		columns: itemColumns,
		inputColumns: others,
		items: {
			data: new Promise(async (fulfil) => {
				let items = await item.findMany({
					include,
					where
				});
				type && flatten(items, type);
				standardizeSelects(items, itemColumns);
				fulfil(items);
			})
		}
	};
}

export const actions = {
	create: async function ({ request, params }) {
		return response(async () => {
			let requestData = await pojoData(request);
			delete requestData['id'];
			const type = requestData.type;
			const [columns, others] = await getItemColumns();
			const joinedColumns = columns.concat(others[type]);
			let check = parseProperties(requestData, joinedColumns);
			if (check) return new fail(400, check);
			let data = { library: { connect: { slug: params.library } } };
			for (let { id } of columns) data[id] = requestData[id];
			let shootOff = {};
			for (let { id } of others[type]) shootOff[id] = requestData[id];
			data[type] = { create: shootOff };
			await item.create({ data });
		}, true);
	}
};
