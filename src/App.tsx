import { framer } from "framer-plugin"
import { useState, useEffect, useMemo } from "react"
import { useCollections } from "./hooks/useCollections"
import { generateMetaDescription, CollectionItem } from "./services/metaDescriptionService"
import { formatSlug } from "./utils"
import { SearchableCombobox } from "./components/SearchableCombobox"
import { StatusMessage } from "./components/StatusMessage"
import "./App.css"

/**
 * @author Pablo Rodriguez @ Screenful
 * @version 1.0.0
 * @description This plugin generates SEO-friendly meta descriptions for your collection items using AI.
 * Check README for further instructions.
 */
framer.showUI({
    position: "top right",
    width: 300,
    height: 410,
})

export function App() {
    const { collections, activeCollection, setCurrentCollection } = useCollections()
    const [isProcessing, setIsProcessing] = useState(false)
    const [isPaused, setIsPaused] = useState(false)
    const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null)
    const [completedItems, setCompletedItems] = useState(0)
    const [totalItems, setTotalItems] = useState(0)
    const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([])
    const [selectedItemId, setSelectedItemId] = useState<string>("all")
    const [openComboboxId, setOpenComboboxId] = useState<string | null>(null)

    // Get formatted items for the comboboxes
    const collectionOptions = useMemo(() => {
        return collections.map(collection => ({
            value: collection.id,
            label: collection.name
        }));
    }, [collections]);

    const itemComboboxItems = useMemo(() => {
        // Add both "All" options at the beginning of the list
        return [
            {
                value: "all",
                label: "All (Add Missing)"
            },
            {
                value: "rewriteAll",
                label: "All (Rewrite All)"
            },
            ...collectionItems.map(item => ({
                value: item.id,
                label: formatSlug(item.slug)
            }))
        ];
    }, [collectionItems]);

    // Load collection items when active collection changes
    useEffect(() => {
        const loadCollectionItems = async () => {
            if (activeCollection) {
                try {
                    const items = await activeCollection.getItems();
                    setCollectionItems(items);
                    // Reset selection to "all" when collection changes
                    setSelectedItemId("all");
                } catch (error) {
                    console.error("Error loading collection items:", error);
                }
            } else {
                setCollectionItems([]);
            }
        };
        
        loadCollectionItems();
    }, [activeCollection]);

    const handleCollectionChange = (selectedId: string) => {
        if (selectedId) {
            setCurrentCollection(selectedId)
        }
    }

    const handleAddMetaDescriptions = async () => {
        if (!activeCollection) return

        try {
            setIsProcessing(true)
            setStatus(null)
            setIsPaused(false)

            // Get collection items
            const items = await activeCollection.getItems()
            
            // Determine which items to process based on selection
            const itemsToProcess = selectedItemId === "all" || selectedItemId === "rewriteAll" 
                ? items 
                : items.filter(item => item.id === selectedItemId);
                
            setTotalItems(itemsToProcess.length)
            setCompletedItems(0)

            // Check if MetaDescription field exists, if not create it
            const fields = await activeCollection.getFields()
            let metaDescFieldId: string | null = null
            
            // Try to find existing MetaDescription field
            const existingMetaDescField = fields.find(field => field.name === "MetaDescription")
            if (existingMetaDescField) {
                metaDescFieldId = existingMetaDescField.id
            } else {
                // Create the MetaDescription field since it doesn't exist
                try {
                    await activeCollection.addFields([{
                        name: "MetaDescription",
                        type: "string"
                    }]);
                    console.log("Created MetaDescription field");
                } catch (error) {
                    console.error("Error creating MetaDescription field:", error);
                    throw new Error("Failed to create MetaDescription field");
                }
                
                // Get the fields again to find our newly created field
                const updatedFields = await activeCollection.getFields()
                metaDescFieldId = updatedFields.find(field => field.name === "MetaDescription")?.id || null
            }
            
            if (!metaDescFieldId) {
                throw new Error("Could not find or create MetaDescription field")
            }

            // Process each item
            let updatedCount = 0

            for (const item of itemsToProcess) {
                try {
                    // Check if the item has a MetaDescription value using the field ID
                    const fieldData = item.fieldData
                    
                    // Determine whether to update this item
                    if (selectedItemId !== "all" || 
                        (selectedItemId === "all" && (!fieldData[metaDescFieldId] || !fieldData[metaDescFieldId].value))) {
                        // Generate AI meta description
                        const metaDescription = await generateMetaDescription(
                            item, 
                            fieldData, 
                            setIsPaused, 
                            setStatus
                        );
                        
                        const fieldUpdate: { [key: string]: { type: "string", value: string } } = {}
                        fieldUpdate[metaDescFieldId] = {
                            type: "string",
                            value: metaDescription
                        }
                        
                        await item.setAttributes({
                            slug: item.slug,
                            fieldData: fieldUpdate
                        });
                        updatedCount++
                    }
                } catch (error) {
                    // Check if this is our specific rate limit error
                    if (error instanceof Error && error.message.includes("Service currently unavailable")) {
                        // Stop processing and show the rate limit error
                        setStatus({
                            success: false,
                            message: error.message
                        });
                        return; // Exit the function early
                    }
                    
                    // For other errors, log but continue with other items
                    console.error(`Error processing item ${item.slug}:`, error);
                }

                setCompletedItems(prev => prev + 1)
            }
            
            // Show success message
            setStatus({
                success: true,
                message: selectedItemId === "all"
                    ? `Updated ${updatedCount} of ${itemsToProcess.length} items with missing meta descriptions.`
                    : selectedItemId === "rewriteAll"
                        ? `Successfully rewrote meta descriptions for all ${updatedCount} items.`
                        : `Successfully rewrote meta description for the selected item.`
            })

        } catch (error) {
            console.error("Error adding meta descriptions:", error)
            setStatus({
                success: false,
                message: error instanceof Error ? error.message : "An error occurred while processing meta descriptions."
            })
        } finally {
            setIsProcessing(false)
            setIsPaused(false)
        }
    }

    // Close any open combobox when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            
            if (openComboboxId !== null && !target.closest('.searchable-combobox')) {
                setOpenComboboxId(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openComboboxId]);

    return (
        <main className="meta-desc-plugin">
            <div className="title-container">
                <h2>Meta Description Generator</h2>
                <div className="tooltip-container">
                    <span className="help-icon">?</span>
                    <div className="tooltip-content">
                        <p><strong>How to use:</strong></p>
                        <ol>
                            <li>Select a collection from the first dropdown</li>
                            <li>In the next dropdown, choose "All" to add or rewrite missing meta descriptions or select a specific item to rewrite</li>
                            <li>Click the button to generate meta descriptions</li>
                        </ol>
                        <p>This plugin uses AI to generate SEO-friendly meta descriptions that include a mention of Screenful.</p>
                        <p><strong>Note:</strong> If rate limits are reached, the process will automatically pause and retry after 60 seconds.</p>
                    </div>
                </div>
            </div>

            <div className="collection-status">
                <SearchableCombobox
                    items={collectionOptions}
                    value={activeCollection?.id || ""}
                    onChange={handleCollectionChange}
                    placeholder="Choose a collection"
                    disabled={isProcessing}
                    label="Select Collection:"
                    id="collection-combobox"
                    openComboboxId={openComboboxId}
                    setOpenComboboxId={setOpenComboboxId}
                />
            </div>

            {activeCollection && (
                <div className="item-selector">
                    <SearchableCombobox
                        items={itemComboboxItems}
                        value={selectedItemId}
                        onChange={setSelectedItemId}
                        placeholder="Choose an item"
                        disabled={isProcessing}
                        label="Select Item:"
                        id="item-combobox"
                        openComboboxId={openComboboxId}
                        setOpenComboboxId={setOpenComboboxId}
                    />
                </div>
            )}

            <button
                className={`action-button ${!activeCollection ? 'disabled' : ''}`}
                onClick={handleAddMetaDescriptions}
                disabled={!activeCollection || isProcessing}
            >
                {isProcessing ? 'Processing...' : (
                    selectedItemId === "all" 
                        ? 'Add Missing Meta Descriptions' 
                        : selectedItemId === "rewriteAll"
                            ? 'Rewrite All Meta Descriptions'
                            : 'Rewrite Meta Description'
                )}
            </button>

            {(isProcessing || isPaused) && totalItems > 0 && (
                <div className="progress-bar">
                    <div
                        className="progress-fill"
                        style={{ width: `${(completedItems / totalItems) * 100}%` }}
                    ></div>
                    <span className="progress-text">{completedItems} / {totalItems}</span>
                </div>
            )}

            <StatusMessage status={status} isPaused={isPaused} />
        </main>
    )
}
