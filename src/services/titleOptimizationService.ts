import { delay, formatSlug } from "../utils";

// Interface for collection items
export interface CollectionItem {
    id: string;
    slug: string;
    fieldData: Record<string, { type: string; value: any }>;
}

// Helper function to optimize titles using Gemini AI
export async function optimizeTitle(
    item: CollectionItem,
    fieldData: Record<string, { type: string; value: any }>,
    titleFieldId: string,
    setIsPaused: (isPaused: boolean) => void,
    setStatus: (status: { success: boolean; message: string } | null) => void
): Promise<string> {
    try {
        const currentTitle = fieldData[titleFieldId]?.value as string || "";
        const currentTitleLength = currentTitle.length;

        // If title is already short enough and not in "rewriteAll" mode, return as is
        if (currentTitleLength <= 70 && item.id !== "rewriteAll") {
            return currentTitle;
        }

        // Extract useful content from fieldData to provide context
        const fieldValues = Object.entries(fieldData).reduce((acc, [fieldId, field]) => {
            if (fieldId !== titleFieldId && field.value && typeof field.value === 'string') {
                acc.push(field.value);
            }
            return acc;
        }, [] as string[]);

        // Create prompt based on whether the title needs optimization or not
        const promptBase = currentTitleLength > 70
            ? `The following title is ${currentTitleLength} characters long, which exceeds the 70 character limit for optimal SEO titles: "${currentTitle}".
            Please optimize this title to be under 70 characters while preserving key words and meaning.`
            : `Please review and optimize this title for SEO while keeping it under 70 characters: "${currentTitle}".`;

        // Prompt for Gemini API
        const prompt = `
            ${promptBase}
            
            Consider the following content from the page for context:
            ${fieldValues.join('\n')}
            
            Guidelines for the optimized title:
            1. Must be under 70 characters
            2. Preserve key words and main meaning of the original title
            3. Avoid duplicate words
            4. Maintain the original tone and intent
            5. Keep brand mentions intact (e.g., "Screenful")
            6. Focus on clarity and readability
            
            Return only the optimized title text without any additional explanation.
        `;

        // Get API key from environment variables
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error("API key not found. Please add VITE_GEMINI_API_KEY to your .env file.");
        }

        // Call Gemini API with retry logic for rate limiting
        const makeRequest = async (retryCount = 0): Promise<string> => {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }]
                })
            });

            // Check specifically for 429 Too Many Requests response
            if (response.status === 429) {
                // Check if we've reached the retry limit
                if (retryCount >= 3) {
                    throw new Error("Service currently unavailable due to rate limits. Please try again later.");
                }

                // Show pause status to the user
                setIsPaused(true);
                setStatus({
                    success: true,
                    message: `Rate limit reached. Pausing for 60 seconds and then resuming... (Retry ${retryCount + 1}/3)`
                });

                // Wait for 61 seconds before retrying
                await delay(61000);

                // Clear pause status
                setIsPaused(false);
                setStatus(null);

                // Retry the same request with incremented retry count
                return makeRequest(retryCount + 1);
            }

            if (!response.ok) {
                throw new Error(`API call failed with status: ${response.status}`);
            }

            const data = await response.json();
            // Extract the text from Gemini's response
            return data.candidates[0].content.parts[0].text.trim();
        };

        const optimizedTitle = await makeRequest();

        // Final check to ensure the title is actually under 70 characters
        if (optimizedTitle.length > 70) {
            return optimizedTitle.substring(0, 67) + "...";
        }

        return optimizedTitle;
    } catch (error) {
        console.error("Error optimizing title:", error);

        // Check if this is our specific rate limit error
        if (error instanceof Error && error.message.includes("Service currently unavailable")) {
            // Re-throw this specific error to be handled by the caller
            throw error;
        }

        // For other errors, return the original title if possible
        return fieldData[titleFieldId]?.value || `${formatSlug(item.slug)} by Screenful`;
    }
}
