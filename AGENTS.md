# Game name

<2d side scrolling shooter>

Tech Stack:

- NextJS for frontend and game shell. runs locally on Windows with Node.js
- PixiJS for rendering runs directly in the browser canvas
- No backend for MVP  use NextJS API routes only if needed
- No Postgres for MVP use browser localStorage for saves/high scores
- No Redis for MVP not needed until multiplayer or real-time backend
- OpenAI for generative AI features

Tips:

- Use build and test commands to verify your work as soon as you complete a feature or task
- Use the PLAN.md file to guide your work when building new features
- Log your work under .logs (create new log files as you see fit) to record your thought process and decisions, and reference them when iterating on features
- Use playwright to test the visual output of your work, and iterate if it doesn't look right or fit the vibe
- Use imagegen to generate visual assets for your work, and every time you generate a collection of assets, save the prompts you used to be able to continue generating more of the same assets later (create files in .prompts)
- Use Context7 MCP to fetch PixiJS docs
