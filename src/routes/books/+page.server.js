import {Book} from "$lib/db.js";

export async function load() {
    const books = await Book.find({}).exec();
    return {
        books: books.map(({title, author, isbn, publisher, num_pages}) => ({title, author, isbn, publisher, num_pages})),
    };
}

export const actions = {
    create: async function ({request}) {
        const data = await request.formData();
        await Book.create({
            title: data.get("title"), author: data.get("author"), isbn: data.get("isbn"),
            publisher: data.get("publisher"), num_pages: data.get("num_pages")
        });
    }, update: async function ({request}) {
        const {type, title, author, isbn, publisher, num_pages} = await request.json();
        if (type === 'delete') {
            await Book.findOneAndDelete({isbn})
        } else if (type === 'update') {
            await Book.findOneAndUpdate({isbn}, {title, author, publisher, num_pages})
        }

    },
};
