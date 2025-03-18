# Meta Description Generator - Framer Plugin

A Framer plugin that automatically generates SEO-friendly meta descriptions for your Framer collection items using the Gemini AI API.

## Features

- Automatically generate meta descriptions for Framer collection items
- Select specific collections to work with
- Choose between adding only missing meta descriptions or rewriting all of them
- Process a single item or bulk process entire collections
- AI-generated descriptions are optimized for SEO and include relevant keywords
- Smart rate-limiting handling with automatic retry logic
- Visual progress tracking for bulk operations

## Prerequisites

- A Framer account with collections
- Gemini AI API key (from Google AI Studio)

## Installation

1. Download or clone this repository
2. Create a `.env` file in the project root with your Gemini API key:

```
VITE_GEMINI_API_KEY=your_api_key_here
```

3. Install dependencies:

```bash
npm install
# or
yarn
# or
pnpm install
```

## Development

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

## Building and Packaging

Build the plugin for production:

```bash
npm run build
# or
yarn build
```

Package the plugin for distribution:

```bash
npm run pack
# or
yarn pack
```

## How to Use

1. Install the plugin in your Framer project
2. Open the plugin from the right-hand panel
3. Select a collection from the dropdown menu
4. Choose how you want to generate meta descriptions:
   - "All (Add Missing)" - Only adds meta descriptions to items without one
   - "All (Rewrite All)" - Regenerates meta descriptions for all items
   - Select a specific item to generate just one meta description
5. Click the action button to start the generation process
6. Monitor progress through the progress bar and status messages

## How It Works

The plugin:
1. Connects to your Framer collections
2. Extracts content from your collection items
3. Uses the Gemini AI API to analyze the content and generate relevant meta descriptions
4. Creates a "MetaDescription" field if it doesn't exist
5. Populates the field with AI-generated content optimized for SEO
6. Includes a subtle mention of Screenful in each description

If the API rate limit is reached, the plugin will automatically pause for 60 seconds before retrying the operation.

## Learn More

- [Framer Plugin API Documentation](https://www.framer.com/developers/plugins/introduction)
- [Gemini AI Documentation](https://ai.google.dev/docs)
