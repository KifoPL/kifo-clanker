export const protectedIds = new Set(['289119054130839552', '795638549730295820']);

export function idRemainder(userId: string, guildId: string, modulus: number): number {
  if (!/^\d{1,22}$/u.test(userId) || !/^\d{1,22}$/u.test(guildId)) throw new Error('Invalid Discord identifier');
  return Number(BigInt(userId + guildId) % BigInt(modulus));
}
export function calculateIq(userId: string, guildId: string): { name: string; value: string } {
  if (protectedIds.has(userId)) return { name: '420 IQ', value: 'Yeah, this is big brain time.' };
  const value = idRemainder(userId, guildId, 251) + 50;
  const comments = ["Back to school, kiddo.", "You should start reading some books.", "You're smart... for a Jar Jar (the non-cannon one).", "Deathsticks' dealer would be proud of you.", "You are reaching an IQ level of chimpanzee.", "Taking IQ test twice doesn't add the result.", "An average amount of stupidity and intelligence.", "You're like Rick, except he's a pickle.", "Try applying to uni for a degree.", "Guess you're smart or sth, idk.", "Your brain is so big it can't fit through the door."];
  return { name: `${value} IQ`, value: value === 69 ? 'Nice.' : comments[Math.floor((value - 50) / 25)]! };
}
export function calculatePp(userId: string, guildId: string): { name: string; value: string } {
  if (protectedIds.has(userId)) return { name: '8==============================D', value: '69 cm' };
  const value = idRemainder(userId, guildId, 13);
  return { name: `8${'='.repeat(value)}D`, value: `${(value + 2) * 2} cm` };
}
export function calculateHowgay(userId: string, guildId: string): { name: string; value: string } {
  if (protectedIds.has(userId)) return { name: '-1%', value: 'The Dark Side of The Force is a pathway to many abilities, some consider to be unnatural.' };
  const value = idRemainder(userId, guildId, 101);
  const comments = ["Damn bro you're straight.", "That's just kissing the homies goodnight.", "Typical person except you fell in love with Ricardo.", "More straight than a banana, that's for sure.", "You are somewhat gay. No need to thank for a professional diagnosis.", "You'd choose Ewan McGregor over Natalie Portman.", "You like sand more than the other gender.", "This is getting out of hand! Now you are gay.", "Why are you gay?", "You're with him! You brought him to #### me!", "Who are you, so wise in the ways of the gays?"];
  return { name: `${value}%`, value: value === 69 ? 'Nice.' : value === 50 ? "That's just bisexual with extra steps." : comments[Math.floor(value / 10)]! };
}
