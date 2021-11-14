const kifo = require("kifo");
const Discord = require("discord.js");

const { Permissions } = require("discord.js");
const ms = require("ms");

const games = new Map();

class Hangman {
	constructor(word) {
		this.word = word;
		this.hiddenWord = word.replace(/[a-zA-Z]/g, "_");
		this.guesses = [];
		this.lives = 6;
		this.status = "playing";
		this.message = `Word: ${
			this.hiddenWord
		}\n__Guesses:__ \`${this.guesses.join(
			`\`, \``
		)}\`\nRemaining lives: \`${this.lives}\``;
	}
	guess(letter) {
		if (this.status === "won" || this.status === "lost") return;
		if (this.guesses.includes(letter))
			return "This letter was already guessed!";
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
			return "Correct!";
		} else {
			this.guesses.push(letter);
			this.lives--;
			this.updateMessage();
			if (this.lives === 0) {
				this.status = "lost";
				return "You lost!";
			}
			return "Incorrect!";
		}
	}
	updateMessage() {
		this.message = `Word: ${
			this.hiddenWord
		}\n__Guesses:__ \`${this.guesses.join(
			`\`, \``
		)}\`\nRemaining lives: \`${this.lives}\`\n\n${drawHangman(this.lives)}`;
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
				},
			],
		},
		{
			name: "guess",
			type: "SUB_COMMAND",
			description: "Guess a letter in current hangman game",
			options: [
				{
					name: "letter",
					type: "STRING",
					description: "The letter to guess",
					required: true,
					choices: [
						{ name: "a", value: "a" },
						{ name: "b", value: "b" },
						{ name: "c", value: "c" },
						{ name: "d", value: "d" },
						{ name: "e", value: "e" },
						{ name: "f", value: "f" },
						{ name: "g", value: "g" },
						{ name: "h", value: "h" },
						{ name: "i", value: "i" },
						{ name: "j", value: "j" },
						{ name: "k", value: "k" },
						{ name: "l", value: "l" },
						{ name: "m", value: "m" },
						{ name: "n", value: "n" },
						{ name: "o", value: "o" },
						{ name: "p", value: "p" },
						{ name: "q", value: "q" },
						{ name: "r", value: "r" },
						{ name: "s", value: "s" },
						{ name: "t", value: "t" },
						{ name: "u", value: "u" },
						{ name: "v", value: "v" },
						{ name: "w", value: "w" },
						{ name: "x", value: "x" },
						{ name: "y", value: "y" },
						{ name: "z", value: "z" },
					],
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
		const { con } = require("../index.js");
		const main = require("../index.js");

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
			let options = subcmd.options;
			let word = options.data.find((d) => d.name === "word")?.value;
			if (word == undefined)
				return message.reply(
					kifo.embed("You must specify a word to guess!")
				);

			//validate word
			if (word.length < 3)
				return itr.reply(
					kifo.embed("Word must be at least 3 characters!")
				);
			if (word.length > 50)
				return itr.reply(
					kifo.embed("Word must be less than 50 characters!")
				);

			//there must be no other game in progress
			if (games.has(itr.channel.id))
				return itr.reply(
					kifo.embed(
						"There is already a game in progress in this channel!"
					)
				);

			//create a new game
			let game = new Hangman(word.toLowerCase());

			//add to map
			games.set(itr.channel.id, game);

			//send the game
			itr.reply(
				kifo.embed(
					`Starting a game of hangman!\n\nThe word is: ${game.hiddenWord}\n\nYou have ${game.lives} lives.`
				)
			);

			return;
		}

		subcmd = itr.options.data.find((d) => d.name === "guess");
		if (subcmd !== undefined) {
			let options = subcmd.options;
			let letter = options.data.find((d) => d.name === "letter")?.value;
			if (letter == undefined)
				return itr.reply(
					kifo.embed("You must specify a letter to guess!")
				);

			//get the game
			let game = games.get(itr.channel.id);
			if (game == undefined)
				return itr.reply(
					kifo.embed("There is no game in progress in this channel!\nYou can start a game by executing `/hangman start <word>`. For more details, execute `/hangman help`")
				);

			//guess the letter
			let result = game.guess(letter);

			if (game.status == "won") {
				itr.reply(
					kifo.embed(
						`You guessed the word!\n\nThe word was: ${game.word}`
					)
				);
				games.delete(itr.channel.id);
				return;
			}
			if (game.status == "lost") {
				itr.reply(
					kifo.embed(`You lost!\n\nThe word was: ${game.word}`)
				);
				games.delete(itr.channel.id);
				return;
			}

			//send the game
			itr.reply(
				kifo.embed(
					`${result}\n\n${game.message}\n\nYou have ${game.lives} lives.`
				)
			);
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
	return hangman;
}
