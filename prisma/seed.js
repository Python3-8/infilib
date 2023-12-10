import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const USERS = [
	['safwansamsudeen@gmail.com', 'Safwan (Superuser)', 'M'],
	['librarian.ups@unityschool.in', 'Shakii', 'M'],
	['naqeebkabir@gmal.com', 'Naqeeb Sultana', 'F']
];

const LIBRARIES = [
	['unity-public', 'Unity Public School', 'Kottur, Chennai', 'librarian.ups@unityschool.in'],
	[
		'test',
		'The Testing Library',
		'Test Address, Random City, Weird Country, Mars',
		'safwansamsudeen@gmail.com'
	],
	[
		'naqeeb-library',
		"Naqeeb's Library",
		'Kottivakkam, Chennai, Tamil Nadu, India',
		'naqeebkabir@gmal.com'
	]
];

async function main() {
	for (let [email_address, name, gender] of USERS) {
		await prisma.user.upsert({
			where: { email_address },
			update: {},
			create: {
				name,
				email_address,
				gender
			}
		});
	}

	for (let [slug, name, address, email_address] of LIBRARIES) {
		await prisma.library.upsert({
			where: { slug: slug },
			update: {},
			create: {
				slug,
				name,
				address,
				administrator: { connect: { email_address } },
				available_subscriptions: {
					create: {
						name: 'Membership',
						no_of_days: 15,
						no_of_books: 4,
						deposit: 500,
						users: {
							create: {
								user: { connect: { email_address } },
								member_id: 1,
								purchased_on: new Date(),
								valid_till: new Date('12/28/2023')
							}
						}
					}
				}
			}
		});
	}
}
main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
