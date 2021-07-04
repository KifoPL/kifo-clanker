module.exports = {
	name: "prefix",
	description: "This command informs you in detail how you can change server prefix.",
	usage: ["`prefix` - sends a DM with details on prefix change process."],
	adminonly: false,
	perms: ["SEND_MESSAGES"],
	execute(message, args, Discord) {
		const kifo = require("kifo");
		message.author.send(kifo.embed(`Hello! I'm really glad you've decided to change prefix on your server.\n\n\
		As harsh as it sounds, making the bot *costs* a lot of time and money ||electricity, coding knowledge, VPS, etc.||, and that's why I have decided to make this a **premium** feature.\n\n\
		Yes, the bot is open source and all of the features are available for free. You can use 100% of the bot with the default prefix if you wish.\n\n\
		However, if you've decided to support my huge work, then I am extremely grateful! Please buy me a beer [here](https://www.buymeacoffee.com/kifoPL) and __receive a custom prefix in return__.\n\
		When buying a beer, **make sure to send me a private message** with an info that allows me to recognize you when you contact me (like your e-mail or your discord ID).\n\n\
		May the force be with you!\n<:KifoSig:851381840367583242>`, "How to buy me a beer and receive cool prefix in return 101:"))
	},
};
