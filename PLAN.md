# 2D Side Scrolling Shooter Plan

## Game Vision

The MVP is a single-player horizontal arcade shooter inspired by R-Type and Gradius. The player pilots a compact starfighter through a hostile alien defense corridor, dodging dense bullet patterns, destroying enemy waves, collecting powerups, and defeating a boss at the end of the stage.

The design priority is readable action first: every ship, bullet, pickup, and hazard should be clear at a glance, even when the screen is busy.

## Player Goal

- Survive the full scrolling stage.
- Destroy enemy waves for score.
- Collect powerups to improve survivability and firepower.
- Defeat the stage boss.
- Set a local high score that persists between browser sessions.

## Main Loop

1. The player starts from the title screen.
2. The stage scrolls from right to left while the player controls the ship freely inside the viewport.
3. Enemy waves enter from the right with distinct movement and firing patterns.
4. The player dodges bullets and collisions while firing back.
5. Stage hazards scroll in as environmental pressure between enemy formations.
6. Defeated enemies award score and may drop powerups.
7. Difficulty escalates through denser waves, faster attacks, and tighter hazard timing.
8. The boss appears near the end of the stage.
9. The run ends in stage clear or game over.
10. Score, high score, and run summary are shown, then the player can replay.

## Inputs and Controls

Keyboard is the MVP input target.

- `WASD` or arrow keys: move ship.
- `Space`: fire primary weapon.
- `Shift`: focus movement for slower precision dodging.
- `Enter`: start or restart.
- `P`: pause or resume.
- `Escape`: pause or return toward menu state.
- Menu sound toggle: mute or unmute procedural audio.

Gamepad support is planned after the MVP input loop is stable.

- D-pad or left stick: move.
- Primary face button: fire.
- Shoulder or trigger: focus movement.

Touch and mouse controls are out of scope for the first playable version.

## Win and Fail States

The player wins the stage by defeating the boss before losing all lives.

The player fails when lives reach zero. A hit from an enemy, bullet, or lethal obstacle removes one life and grants brief invulnerability so one mistake does not cascade instantly.

Run summary should show:

- Final score.
- High score.
- Enemies destroyed.
- Bosses destroyed.
- Max combo.
- Pickups collected.
- Hazards dodged and hazard hits.
- Stage result.
- Prompt to restart.

## Progression and Difficulty

The MVP contains one complete stage. Additional stages come later once the first stage feels good.

Difficulty escalates through:

- More frequent enemy waves.
- Enemies with wider movement arcs.
- Faster bullet speeds.
- More bullets per wave.
- Stage hazards that force lane changes between combat beats.
- Boss phase changes at lower health.

MVP powerups:

- Spread shot: adds angled side shots.
- Laser charge: upgrades the primary shot into a piercing beam.
- Shield: absorbs one hit.
- Option drone: mirrors player fire from a trailing satellite.
- Score bonus: immediate score reward.

Persistent progression is intentionally light for MVP. Browser `localStorage` stores only high score and simple settings.

## Visual Direction

The game should look like crisp modern arcade sci-fi with retro shooter roots.

- Horizontal 16:9 playfield.
- Dark space and alien-machine environments.
- Strong silhouettes for the player, enemies, and boss.
- Bright player shots and warmer enemy bullets.
- Layered parallax starfields and generated concept art used as background inspiration.
- Controlled effects: muzzle flashes, engine trails, compact explosions, and light screen shake.
- HUD stays minimal and readable.

The first biome is a deep-space alien defense corridor: stars and nebulae behind mechanical silhouettes, leaving a clear central flight lane.

## Stack and Hosting Assumptions

- Next.js provides the browser app shell, metadata, menus, and static hosting path.
- PixiJS renders the game into a browser canvas.
- TypeScript is used for gameplay code.
- React owns page layout and lifecycle; Pixi owns real-time rendering.
- No backend is required for MVP.
- No database is required for MVP.
- `localStorage` stores high scores and settings.
- Future OpenAI features should use the Responses API for new text generation work, based on current OpenAI docs guidance that Responses is recommended for new projects.
- Possible AI features are mission briefings, stage names, enemy lore, and asset prompt ideation. Core gameplay remains deterministic and client-side.
- The app should run locally on Windows with Node.js and should be deployable to Vercel or any standard Next.js host.

## Milestone Order

1. **Project foundation**
   - Create Next.js app structure.
   - Add PixiJS canvas mount.
   - Add responsive game shell and HUD.

2. **Player ship**
   - Movement bounds.
   - Keyboard input.
   - Primary firing.
   - Lives and invulnerability.

3. **Core combat**
   - Enemy spawning.
   - Enemy movement patterns.
   - Player bullets.
   - Enemy bullets.
   - Collision detection.
   - Score tracking.

4. **Stage structure**
   - Timed wave script.
   - Parallax background.
   - Difficulty ramp.
   - Stage timer.

5. **Powerups**
   - Pickup drops.
   - Spread shot.
   - Shield.
   - Option drone.

6. **Boss encounter**
   - Boss entrance.
   - Health bar.
   - Attack phases.
   - Stage clear state.

7. **Stage hazards**
   - Asteroid/debris fields.
   - Plasma vent hazards.
   - Hazard pacing per stage.

8. **Menus and persistence**
   - Title state.
   - Pause state.
   - Game over state.
   - Stage clear state.
   - High score saved in `localStorage`.
   - Replay/run summary.
   - Sound mute toggle.

9. **Polish and validation**
   - Visual effects.
   - Audio hooks.
   - Difficulty tuning.
   - Playwright visual checks at desktop and mobile sizes.

10. **Optional AI layer**
   - Add a Next.js API route for generated mission text only if needed.
   - Keep API keys server-side.
   - Use structured outputs if generated content needs a fixed schema.

## Current MVP Target

The first implementation target is a playable browser prototype with one continuous stage, procedural enemy waves, keyboard controls, scoring, lives, pause, restart, local high score, and a boss clear condition.
