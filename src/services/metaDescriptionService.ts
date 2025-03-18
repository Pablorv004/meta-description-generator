import { delay, formatSlug } from "../utils";

// Interface for collection items
export interface CollectionItem {
    id: string;
    slug: string;
    fieldData: Record<string, { type: string; value: any }>;
}

// Helper function to generate meta descriptions using Gemini AI
export async function generateMetaDescription(
    item: CollectionItem,
    fieldData: Record<string, { type: string; value: any }>,
    setIsPaused: (isPaused: boolean) => void,
    setStatus: (status: { success: boolean; message: string } | null) => void
): Promise<string> {
    try {
        // Extract useful content from fieldData to use in prompt
        const fieldValues = Object.entries(fieldData).reduce((acc, [_, field]) => {
            if (field.value && typeof field.value === 'string') {
                acc.push(field.value);
            }
            return acc;
        }, [] as string[]);

        // Prompt for gemini API. Change the prompt as needed.
        const prompt = `
            Generate a concise and SEO-friendly meta description (max 160 characters) for a webpage about "${formatSlug(item.slug)}".
            
            Here's the content from the page:
            ${fieldValues.join('\n')}
            
            The meta description should:
            1. Include relevant keywords
            2. Be engaging and informative
            3. Include a subtle mention of Screenful (the company behind the website)
            4. Not exceed 160 characters
            
            Return only the meta description text without any additional explanation.
        `;
        
        // Get API key from environment variables
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        
        if (!apiKey) {
            throw new Error("API key not found. Please add VITE_GEMINI_API_KEY to your .env file.");
        }
        
        // Call Gemini API with retry logic for rate limiting (429 stuff)
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
        
        return await makeRequest();
    } catch (error) {
        console.error("Error generating meta description:", error);
        
        // Check if this is our specific rate limit error
        if (error instanceof Error && error.message.includes("Service currently unavailable")) {
            // Re-throw this specific error to be handled by the caller
            throw error;
        }
        
        // Fallback description if API fails for other reasons
        return `Discover insights about ${formatSlug(item.slug)} with Screenful's innovative solutions.`;
    }
}
