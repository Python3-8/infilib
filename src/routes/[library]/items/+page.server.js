import { item } from '$lib/db.js';
import { pojoData, response } from '$lib/serverHelpers.js';
import { fail, redirect } from '@sveltejs/kit';
import { getBookColumns, getMagazineColumns, getItemColumns } from '$lib/columns.js';
import { flatten, injectLibraryInSelect } from '$lib/helpers.js';
import { validateAndClean } from '$lib/validators.js';

export async function load({ url, params }) {
	const library_slug = params.library;
	return {
		streamed: {
			items: (async () => {
				let columns = await getItemColumns(library_slug);

				// Set up DB params for modification
				let where = { library_slug };
				let include = {
					publisher: true,
					categories: true,
					languages: true,
					book: { include: { authors: true } },
					magazine: true
				};

				// If there's a type specified, add columns and change DB call
				let type;
				for (let [key, val] of url.searchParams.entries()) {
					if (key === 'show' && ['book', 'magazine'].includes(val)) {
						type = val;
						const otherColumns = await (type === 'book' ? getBookColumns : getMagazineColumns)();
						where[val] = { isNot: null };
						columns = columns.concat(otherColumns);
						break;
					}
				}
				let items, newItems, popularItems, searchResults;
				const search = url.searchParams.get('search');
				const searchResultsGiven = url.searchParams.get('search-results');
				if (url.searchParams.get('all') === 'true') {
					items = await item.findMany({
						include,
						where,
						cacheStrategy: { swr: 60, ttl: 60 },
						orderBy: {
							acc_no: 'asc'
						}
					});
					if (type) flatten(items, type);
				} else if (search) {
					searchResults = await item.findMany({
						take: 3,
						include,
						where: {
							...where,
							OR: [
								{ title: { contains: search, mode: 'insensitive' } },
								{
									book: {
										OR: [
											{ subtitle: { contains: search, mode: 'insensitive' } },
											{ isbn: { contains: search, mode: 'insensitive' } },
											{ authors: { some: { name: { contains: search, mode: 'insensitive' } } } }
										]
									}
								},
								{ categories: { some: { name: { contains: search, mode: 'insensitive' } } } },
								{ publisher: { name: { contains: search, mode: 'insensitive' } } }
							]
						}
					});
					if (type) flatten(searchResults, type);
				} else if (searchResultsGiven) {
					searchResults = await item.findMany({
						include,
						where: {
							...where,
							id: { in: searchResultsGiven.split(',').map(Number) }
						}
					});
					if (type) flatten(searchResults, type);
				} else {
					newItems = await item.findMany({
						take: 25,
						include,
						where,
						orderBy: {
							purchased_on: {
								sort: 'desc'
							}
						},
						cacheStrategy: { swr: 60, ttl: 60 }
					});
					popularItems = await item.findMany({
						take: 25,
						include: {
							...include,
							transactions: true
						},
						where,
						orderBy: {
							transactions: {
								_count: 'desc'
							}
						},
						cacheStrategy: { swr: 60, ttl: 60 }
					});

					if (type) {
						flatten(newItems, type);
						flatten(popularItems, type);
					}
				}

				return {
					items,
					columns,
					newItems,
					popularItems,
					searchResults
				};
			})()
		}
	};
}

export const actions = {
	create: async function ({ request, params }) {
		return response(async () => {
			let requestData = await pojoData(request);
			delete requestData['id'];
			const itemType = requestData.type;
			const [columns, others] = await getItemColumns(params.library);
			const joinedColumns = columns.concat(others[itemType]);

			let check = validateAndClean(requestData, joinedColumns);
			if (check) return new fail(400, check);

			let data = { library: { connect: { slug: params.library } } };
			for (let { id, type } of columns)
				data[id] =
					type === 'select'
						? injectLibraryInSelect(requestData[id], params.library)
						: requestData[id];
			let shootOff = {};
			for (let { id, type } of others[itemType]) {
				shootOff[id] =
					type === 'select'
						? injectLibraryInSelect(requestData[id], params.library)
						: requestData[id];
			}
			data[itemType] = { create: shootOff };
			await item.create({ data });
		}, true);
	},
	goto: async function ({ request, params }) {
		let { data } = await pojoData(request);
		let item_obj;

		if (data.startsWith('978') || data.length > 10) {
			item_obj = await item.findFirst({ where: { book: { isbn: data } } });
		} else {
			item_obj = await item.findFirst({ where: { acc_no: +data } });
		}
		if (!item_obj) {
			return fail(404, { message: "Doesn't exist" });
		}
		throw redirect(303, `/${params.library}/items/${item_obj.id}`);
	}
};
