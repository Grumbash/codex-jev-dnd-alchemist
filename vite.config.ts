import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { TypeSafeClient, choice, noul, score } from '@typesafe-ai/sdk';

function jevServerMiddleware(): Plugin {
  return {
    name: 'jev-typesafe-api-middleware',
    configureServer(server) {
      server.middlewares.use('/api/jev/status', async (_req, res) => {
        const env = loadEnv('development', process.cwd(), '');
        const hasEnvKey = Boolean(env.TYPESAFE_API_KEY || process.env.TYPESAFE_API_KEY);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ hasEnvKey, sdkVersion: '0.7.0' }));
      });

      server.middlewares.use('/api/jev/decide', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let rawBody = '';
        req.on('data', (chunk) => {
          rawBody += chunk;
        });

        req.on('end', async () => {
          const startTime = performance.now();
          try {
            const body = JSON.parse(rawBody || '{}');
            const env = loadEnv('development', process.cwd(), '');
            const apiKey =
              (req.headers['x-typesafe-api-key'] as string) ||
              env.TYPESAFE_API_KEY ||
              process.env.TYPESAFE_API_KEY;

            if (!apiKey) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  error: 'NO_API_KEY',
                  message:
                    'TYPESAFE_API_KEY is not configured. Using calibrated NAR engine or set key in HUD.',
                })
              );
              return;
            }

            const client = new TypeSafeClient({ apiKey });

            const station: string = body.state?.station || 'alchemist';
            const archetypeCriteria: Record<string, string> =
              station === 'alchemist'
                ? {
                    healing_draught: 'Restorative crimson or herbal vitality potion',
                    deadly_poison: 'Corrosive or neurotoxic venom coating',
                    volatile_bomb: 'Explosive alchemical grenade or flask',
                    weapon_oil: 'Elemental blade coating oil',
                    mutagen_elixir: 'Transmutative body-altering mutagen brew',
                    astral_solvent: 'Arcane dissolving essence or ethereal philter',
                  }
                : station === 'blacksmith'
                ? {
                    dagger: 'Quick piercing blade or fang knife',
                    longsword: 'Balanced martial blade',
                    warhammer: 'Heavy crushing maul or club',
                    whip: 'Flexible lashed tentacle or chain weapon',
                    breastplate: 'Protective cuirass or scale armor',
                    shield: 'Defensive bulwark or carapace buckler',
                    belt_girdle: 'Reinforced martial war girdle or titan belt',
                    gauntlets: 'Armored combat gauntlets or spiked knuckles',
                  }
                : {
                    ring: 'Channeling finger band or sigil ring',
                    wand: 'Focused arcane beam rod or eye-stalk',
                    amulet: 'Protective talisman or heart pendant',
                    cloak: 'Phase-shifting mantle or hide cape',
                    orb: 'Resonant floating focus sphere',
                    scroll: 'Inscribed runic parchment of power',
                    belt_girdle: 'Runic alchemist utility belt or potion bandolier',
                    boots: 'Enchanted strider boots or phase-step greaves',
                  };

            const { answers } = await client.systemOne({
              state: body.state,
              questions: {
                isCompatible: noul(
                  'Do these D&D monster reagents synergize into a functional magical item without neutralizing each other?'
                ),
                volatility: score(
                  'How unstable, hazardous, and difficult to control is this alchemical reaction?',
                  [
                    '1 - Harmonious and stable',
                    '2 - Mildly reactive',
                    '3 - Moderately volatile',
                    '4 - Highly unstable',
                    '5 - Catastrophic arcane overload',
                  ]
                ),
                itemArchetype: choice(
                  `Which ${station} item form best fits these monster reagents?`,
                  archetypeCriteria
                ),
                elementAffinity: choice(
                  'Which D&D damage or elemental affinity dominates the reaction?',
                  {
                    acid: 'Corrosive ooze, dissolving bile, digestive enzymes',
                    fire: 'Draconic flame, magma, searing heat',
                    cold: 'Frost, glacial chill, numbing ice',
                    poison: 'Venomous stinger, toxic spores, neurotoxin',
                    necrotic: 'Undead essence, soul rot, vampiric blood, lich dust',
                    psychic: 'Mind flayer psionics, astral thought, madness',
                    force: 'Pure arcane energy, antimagic, phase distortion',
                    lightning: 'Storm charge, bio-electric shock',
                    radiant: 'Searing light, celestial or prismatic glow',
                  }
                ),
                specialEffect: choice(
                  'Which special D&D mechanical property manifests in the crafted item?',
                  {
                    corrosion: 'Melts enemy armor and reduces AC on hit',
                    phase_shift: 'Projects illusory displacement causing attacks to miss',
                    vampiric: 'Drains vitality from targets to heal the wielder',
                    antimagic: 'Disrupts active spells and suppresses magic',
                    petrification: 'Slows and turns flesh into rigid stone',
                    mind_blast: 'Stuns enemies with psionic shockwaves',
                    adhesive: 'Grapples and immobilizes anything it touches',
                    hellfire: 'Ignites targets in unquenchable dragonfire',
                    regeneration: 'Continuously mends wounds each turn',
                  }
                ),
                curseRisk: noul(
                  'Does this combination carry dark, sentient, or aberrant energy that risks cursing the user on a failed check?'
                ),
              },
            });

            const latencyMs = Math.round(performance.now() - startTime);
            // Note: score in @typesafe-ai/sdk is 0-indexed (0..4 for 5 levels), so we normalize to 1..5
            const normalizedAnswers = {
              ...answers,
              volatility: {
                ...answers.volatility,
                score: Math.min(5, Math.max(1, Math.round(answers.volatility.score + 1))),
              },
            };

            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                source: 'live-jev',
                latencyMs,
                answers: normalizedAnswers,
              })
            );
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: 'JEV_EXECUTION_ERROR',
                message: err?.message || 'Failed to invoke TypeSafe Jev SDK',
              })
            );
          }
        });
      });

      server.middlewares.use('/api/jev/haggle', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let rawBody = '';
        req.on('data', (chunk) => {
          rawBody += chunk;
        });

        req.on('end', async () => {
          const startTime = performance.now();
          try {
            const body = JSON.parse(rawBody || '{}');
            const env = loadEnv('development', process.cwd(), '');
            const apiKey =
              (req.headers['x-typesafe-api-key'] as string) ||
              env.TYPESAFE_API_KEY ||
              process.env.TYPESAFE_API_KEY;

            if (!apiKey) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'NO_API_KEY' }));
              return;
            }

            const client = new TypeSafeClient({ apiKey });
            const { answers } = await client.systemOne({
              state: body.state,
              questions: {
                willAccept: noul(
                  'Does this D&D merchant accept the player’s demanded price given their collector preferences, the item qualities, and the Charisma check result?'
                ),
                merchantMood: score(
                  'How pleased or offended is the merchant during this negotiation?',
                  [
                    '1 - Furious and insulted',
                    '2 - Annoyed and skeptical',
                    '3 - Neutral and calculating',
                    '4 - Impressed by the pitch',
                    '5 - Delighted collector',
                  ]
                ),
                counterReaction: choice(
                  'What is the merchant’s final negotiation decision?',
                  {
                    accept_gladly: 'Eagerly pays the demanded price in full',
                    grudging_deal: 'Reluctantly agrees to the demanded price',
                    counter_offer: 'Rejects the full markup but offers a fair compromise',
                    insulted_refusal: 'Offended by the greed or failed bluff and cuts the price',
                  }
                ),
              },
            });

            const latencyMs = Math.round(performance.now() - startTime);
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                source: 'live-jev',
                latencyMs,
                answers: {
                  ...answers,
                  merchantMood: {
                    ...answers.merchantMood,
                    score: Math.min(5, Math.max(1, Math.round(answers.merchantMood.score + 1))),
                  },
                },
              })
            );
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: 'JEV_HAGGLE_ERROR',
                message: err?.message || 'Failed to invoke TypeSafe Jev SDK for haggling',
              })
            );
          }
        });
      });

      server.middlewares.use('/api/jev/raid', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let rawBody = '';
        req.on('data', (chunk) => {
          rawBody += chunk;
        });

        req.on('end', async () => {
          const startTime = performance.now();
          try {
            const body = JSON.parse(rawBody || '{}');
            const env = loadEnv('development', process.cwd(), '');
            const apiKey =
              (req.headers['x-typesafe-api-key'] as string) ||
              env.TYPESAFE_API_KEY ||
              process.env.TYPESAFE_API_KEY;

            if (!apiKey) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'NO_API_KEY' }));
              return;
            }

            const client = new TypeSafeClient({ apiKey });
            const { answers } = await client.systemOne({
              state: body.state,
              questions: {
                winProbability: noul(
                  'Does this D&D hero defeat the monster in a direct raid encounter given their HP, AC, attack bonus, equipped artifacts, and monster Challenge Rating?'
                ),
                ambushRisk: noul(
                  'Does the monster successfully ambush or catch the hero off-guard in its lair?'
                ),
                monsterTactic: choice(
                  'Which combat tactic does this monster employ during the raid?',
                  {
                    frenzied_assault: 'Brutal multi-attack blitz in opening rounds',
                    lair_ambush: 'Stealth strike from lair shadows or environmental cover',
                    arcane_barrage: 'Devastating spell or breath weapon bombardment',
                    regenerative_stall: 'Outlasting the hero via tissue regeneration',
                    soul_drain: 'Necrotic or psychic life-siphoning attacks',
                  }
                ),
                battlefieldHazard: choice(
                  'Which environmental hazard dominates the monster lair?',
                  {
                    caustic_mist: 'Corrosive fumes or deep water hindering movement',
                    unstable_leyline: 'Volatile arcane anomalies amplifying critical hits',
                    blood_frenzy: 'Predatory battlegrounds increasing aggression',
                    clear_sanctum: 'Stable footing with no severe hazards',
                  }
                ),
                organPreservation: score(
                  'How intact and well-preserved are the monster’s alchemical organs after combat?',
                  [
                    '1 - Mangled and scorched',
                    '2 - Partially damaged',
                    '3 - Standard field harvest',
                    '4 - Clean surgical kill',
                    '5 - Pristine anatomical specimen',
                  ]
                ),
              },
            });

            const latencyMs = Math.round(performance.now() - startTime);
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                source: 'live-jev',
                latencyMs,
                answers: {
                  ...answers,
                  organPreservation: {
                    ...answers.organPreservation,
                    score: Math.min(
                      5,
                      Math.max(1, Math.round(answers.organPreservation.score + 1))
                    ),
                  },
                },
              })
            );
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: 'JEV_RAID_ERROR',
                message: err?.message || 'Failed to invoke TypeSafe Jev SDK for raid',
              })
            );
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), jevServerMiddleware()],
});

