import { character as c0 } from "../characters/king/character.js";
import { character as c1 } from "../characters/warrior/character.js";
import { archer as c2 } from "../src/characters/archer.js";
import { character as c3 } from "../characters/mage/character.js";
import { character as c4 } from "../characters/demon-king/character.js";
import { character as c5 } from "../characters/goblin/character.js";
import { character as c6 } from "../characters/skeleton-archer/character.js";
import { character as c7 } from "../characters/dark-mage/character.js";
export const characters = [c0, c1, c2, c3, c4, c5, c6, c7];
export function registerCharacters(renderer) { for (const character of characters) renderer.registerCharacter(character); return characters; }
