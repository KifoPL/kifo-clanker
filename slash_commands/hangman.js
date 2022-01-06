const kifo = require("kifo");
const Discord = require("discord.js");

const { Permissions } = require("discord.js");
const ms = require("ms");

const games = new Map();

class Hangman {
	constructor(word, authorId) {
		this.word = `\`${word}\``;
		this.hiddenWord = this.word.replace(/[a-zA-Z]/g, "_");
		this.guesses = [];
		this.lives = 6;
		this.status = "playing";
		this.userId = authorId;
		this.message = "";
		this.gameMessage = null;
	}
	guess(letter) {
		if (this.status === "won" || this.status === "lost") return;
		if (this.guesses.includes(letter))
			return `- letter \`${letter}\` was already guessed!`;
		if (this.word.includes(letter)) {
			this.guesses.push(letter);
			this.hiddenWord = this.word.replace(/[a-zA-Z]/g, (char) => {
				return this.guesses.includes(char) ? char : "_";
			});
			this.updateMessage();
			if (!this.hiddenWord.includes("_")) {
				this.status = "won";
				return "You won!";
			}
			return `- \`${letter}\` is correct!`;
		} else {
			this.guesses.push(letter);
			this.lives--;
			this.updateMessage();
			if (this.lives === 0) {
				this.status = "lost";
				return "You lost!";
			}
			return `- \`${letter}\` is incorrect!`;
		}
	}
	//guess many letters
	guessMany(letters) {
		let message = "";
		for (let i = 0; i < letters.length; i++) {
			message += this.guess(letters[i]) + "\n";
		}
		return message;
	}
	updateMessage() {
		this.message = `__Word:__ ${this.hiddenWord}\n__Guesses:__ ${
			this.guesses.length === 0
				? ""
				: `\`${this.guesses.join(`\`, \``)}\``
		}\n__Remaining lives:__ \`${this.lives}\`\n\n${drawHangman(
			this.lives
		)}`;
	}
	//print all properties in console.log
	print() {
		console.log(this);
	}
}

module.exports = {
	name: "hangman",
	description: "Play hangman inside of Discord chat!",
	options: [
		{
			name: "help",
			type: "SUB_COMMAND",
			description: "Instructions on how to play hangman",
		},
		{
			name: "start",
			type: "SUB_COMMAND",
			description: "Start a game of hangman!",
			options: [
				{
					name: "word",
					type: "STRING",
					description: "The word to guess",
					required: true,
				},
			],
		},
		{
			name: "stop",
			type: "SUB_COMMAND",
			description: "Stop a game of hangman!",
		},
		{
			name: "guess",
			type: "SUB_COMMAND",
			description: "Guess a letter in current hangman game",
			options: [
				{
					name: "letters",
					type: "STRING",
					description: "The letter (or letters) to guess",
					required: true,
				},
			],
		},
	],
	defaultPermission: true,
	guildonly: false,
	category: "DEBUG",
	perms: ["USE_APPLICATION_COMMANDS"],

	//itr = interaction
	async execute(itr) {
		let subcmd = itr.options.data.find((d) => d.name === "help");
		if (subcmd !== undefined) {
			let btnRow = new Discord.MessageActionRow().addComponents(
				new Discord.MessageButton()
					.setLabel("Hangman Guide")
					.setStyle("LINK")
					.setURL(
						"https://kifopl.github.io/kifo-clanker/docs/guides/hangman"
					)
			);
			itr.reply({
				components: [btnRow],
				embeds: [
					kifo.embed("Click the button to learn more about hangman."),
				],
				ephemeral: true,
			}).catch(() => {});
			return;
		}

		subcmd = itr.options.data.find((d) => d.name === "start");
		if (subcmd !== undefined) {
			await itr.deferReply({ ephemeral: true });
			let options = subcmd.options;
			let word = options.find((d) => d.name === "word")?.value;
			if (word == undefined)
				return itr.editReply({
					embeds: [kifo.embed("channelId specify a word to guess!")],
				});

			//validate word
			if (word.length < 3)
				return itr.editReply({
					embeds: [kifo.embed("Word must be at least 3 characters!")],
				});
			if (word.length > 50)
				return itr.editReply({
					embeds: [
						kifo.embed("Word must be less than 50 characters!"),
					],
				});

			//there must be no other game in progress
			if (games.has(itr.channelId))
				return itr.editReply({
					embeds: [
						kifo.embed(
							"There is already a game in progress in this channel!"
						),
					],
				});

			//create a new game
			let game = new Hangman(word.toLowerCase(), itr.user.id);
			game.updateMessage();

			//add to map
			games.set(itr.channelId, game);

			//send the game
			await itr.editReply({
				embeds: [
					kifo.embed(
						`Starting a game of hangman!\n\nThe word is: ${game.word}\n\nThere are ${game.lives} guesses remaining.`
					),
				],
			});

			game.gameMessage = await itr.followUp({
				embeds: [
					kifo.embed(
						`**<@!${itr.user.id}> has started a new game of hangman!**\n\n${game.message}`
					),
				],
			});

			return;
		}

		subcmd = itr.options.data.find((d) => d.name === "stop");
		if (subcmd !== undefined) {
			await itr.deferReply({ ephemeral: true });
			if (!games.has(itr.channelId))
				return itr.editReply({
					embeds: [
						kifo.embed(
							"There is no game in progress in this channel!"
						),
					],
					ephemeral: true,
				});

			let game = games.get(itr.channelId);
			if (game.userId !== itr.user.id)
				return itr.editReply({
					embeds: [
						kifo.embed(
							"You are not the game creator! Only the creator can stop the game!"
						),
					],
					ephemeral: true,
				});

			games.delete(itr.channelId);
			return itr.editReply({
				embeds: [
					kifo.embed(
						`Game of hangman has been stopped!\n\nThe word was: ${game.word}`
					),
				],
			});
		}

		subcmd = itr.options.data.find((d) => d.name === "guess");
		if (subcmd !== undefined) {
			let options = subcmd.options;
			let letter = options.find((d) => d.name === "letters")?.value;
			if (letter == undefined)
				return itr.reply({
					embeds: [
						kifo.embed("Specify a letter to guess!"),
					],
					ephemeral: true,
				});

			//validate letter
			if (letter.match(/[^a-z]/i))
				return itr.reply({
					embeds: [kifo.embed("Please type only letters a-z (ex. `/hangman guess abcd`)!")],
					ephemeral: true,
				});

			//get the game
			let game = games.get(itr.channelId);
			if (game == undefined)
				return itr.reply({
					embeds: [
						kifo.embed(
							"There is no game in progress in this channel!\nYou can start a game by executing `/hangman start <word>`. For more details, execute `/hangman help`"
						),
					],
					ephemeral: true,
				});

			//game creator can't guess
			if (game.userId === itr.user.id)
				return itr.reply({
					embeds: [
						kifo.embed("You can't guess letters in your own game!"),
					],
					ephemeral: true,
				});

			//guess the letter
			let result =
				letter.length === 1
					? game.guess(letter)
					: game.guessMany(letter);

			if (game.status == "won") {
				game.gameMessage.edit({
					embeds: [
						kifo.embed(
							`**<@!${itr.user.id}> has guessed the word!**\n\n${game.message}`
						),
					],
					ephemeral: true,
				});
				games.delete(itr.channelId);
				itr.channel.send({
					embeds: [
						kifo.embed(
							`**<@!${itr.user.id}> has guessed the word!**\n\n${game.message}`
						),
					],
					ephemeral: true,
				});
				itr.reply({
					embeds: [
						kifo.embed(
							`You have won the game of hangman!\n\nThe word was: ${game.word}`
						),
					],
					ephemeral: true,
				});
				return;
			}

			if (game.status == "lost") {
				game.gameMessage.edit({
					embeds: [
						kifo.embed(
							`**<@!${itr.user.id}> has lost the game!**\n\n${game.message}`
						),
					],
				});
				games.delete(itr.channelId);
				itr.channel.send({
					embeds: [
						kifo.embed(
							`**<@!${itr.user.id}> has lost the game!**\n\n${game.message}`
						),
					],
				});
				itr.reply({
					embeds: [
						kifo.embed(
							`You have lost the game of hangman!\n\nThe word was: ${game.word}`
						),
					],
					ephemeral: true,
				});
				return;
			}

			//send the game
			game.gameMessage.edit({
				embeds: [
					kifo.embed(
						`<@!${itr.user.id}>,\n${result}\n\n${game.message}`
					),
				],
			});

			itr.reply({
				embeds: [kifo.embed(`${result}`)],
				ephemeral: true,
			});
		}
	},
	async button(itr) {
		itr.reply({ embeds: [kifo.embed("Hello there!")] });
	},
	async selectMenu(itr) {},
};

function drawHangman(guessesRemaining) {
	let hangman = "";
	switch (guessesRemaining) {
		case 6:
			hangman =
				" ________\n" +
				"|        |\n" +
				"|\n" +
				"|\n" +
				"|\n" +
				"|\n" +
				"|\n" +
				"|________\n";
			break;
		case 5:
			hangman =
				" ________\n" +
				"|        |\n" +
				"|        O\n" +
				"|\n" +
				"|\n" +
				"|\n" +
				"|\n" +
				"|________\n";
			break;
		case 4:
			hangman =
				" ________\n" +
				"|        |\n" +
				"|        O\n" +
				"|        |\n" +
				"|\n" +
				"|\n" +
				"|\n" +
				"|________\n";
			break;
		case 3:
			hangman =
				" ________\n" +
				"|        |\n" +
				"|        O\n" +
				"|       /|\\\n" +
				"|\n" +
				"|\n" +
				"|\n" +
				"|________\n";
			break;
		case 2:
			hangman =
				" ________\n" +
				"|        |\n" +
				"|        O\n" +
				"|       /|\\\n" +
				"|       /\n" +
				"|\n" +
				"|\n" +
				"|________\n";
			break;
		case 1:
			hangman =
				" ________\n" +
				"|        |\n" +
				"|        O\n" +
				"|       /|\\\n" +
				"|       / \\\n" +
				"|\n" +
				"|\n" +
				"|________\n";
			break;
		case 0:
			hangman =
				" ________\n" +
				"|        |\n" +
				"|        O\n" +
				"|       /|\\\n" +
				"|       / \\\n" +
				"|        |\n" +
				"|        |\n" +
				"|________|\n";
			break;
		default:
			hangman =
				" ________\n" +
				"|        |\n" +
				"|        O\n" +
				"|       /|\\\n" +
				"|       / \\\n" +
				"|        |\n" +
				"|        |\n" +
				"|________|\n";
			break;
	}
	return `\`\`\`\n${hangman}\n\`\`\``;
}
