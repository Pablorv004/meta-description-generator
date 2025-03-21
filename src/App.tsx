import { framer } from "framer-plugin"
import { useState, useEffect, useMemo } from "react"
import { useCollections } from "./hooks/useCollections"
import { optimizeTitle, CollectionItem } from "./services/titleOptimizationService"
import { formatSlug } from "./utils"
import { SearchableCombobox } from "./components/SearchableCombobox"
import { StatusMessage } from "./components/StatusMessage"
import "./App.css"

/**
 * @author Pablo Rodriguez @ Screenful
 * @version 1.0.0
 * @description This plugin optimizes titles for your collection items using AI.
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
                label: "All (Optimize Long Titles)"
            },
            {
                value: "rewriteAll",
                label: "All (Optimize All Titles)"
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

    const handleOptimizeTitles = async () => {
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

            // Find the Title field ID
            const fields = await activeCollection.getFields()
            const titleField = fields.find(field => field.name === "Title")

            if (!titleField) {
                throw new Error("Could not find Title field in this collection")
            }

            const titleFieldId = titleField.id

            // Process each item
            let updatedCount = 0

            for (const item of itemsToProcess) {
                try {
                    // Get the current title from field data
                    const fieldData = item.fieldData
                    const currentTitle = fieldData[titleFieldId]?.value as string || ""

                    // Determine whether to update this item
                    const titleIsTooLong = currentTitle.length > 70

                    if (selectedItemId === "rewriteAll" ||
                        selectedItemId !== "all" ||
                        (selectedItemId === "all" && titleIsTooLong)) {

                        // Generate optimized title
                        const optimizedTitle = await optimizeTitle(
                            item,
                            fieldData,
                            titleFieldId,
                            setIsPaused,
                            setStatus
                        );

                        // Only update if the title actually changed
                        if (optimizedTitle !== currentTitle) {
                            const fieldUpdate: { [key: string]: { type: "string", value: string } } = {}
                            fieldUpdate[titleFieldId] = {
                                type: "string",
                                value: optimizedTitle
                            }

                            await item.setAttributes({
                                slug: item.slug,
                                fieldData: fieldUpdate
                            });
                            updatedCount++
                        }
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
                    ? `Optimized ${updatedCount} of ${itemsToProcess.length} items with titles over 70 characters.`
                    : selectedItemId === "rewriteAll"
                        ? `Successfully optimized titles for all ${updatedCount} items.`
                        : `Successfully optimized title for the selected item.`
            })

        } catch (error) {
            console.error("Error optimizing titles:", error)
            setStatus({
                success: false,
                message: error instanceof Error ? error.message : "An error occurred while optimizing titles."
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
                <h2>Title Optimizer</h2>
                <div className="tooltip-container">
                    <span className="help-icon">?</span>
                    <div className="tooltip-content">
                        <p><strong>How to use:</strong></p>
                        <ol>
                            <li>Select a collection from the first dropdown</li>
                            <li>In the next dropdown, choose "All (Optimize Long Titles)" to optimize only titles that exceed 70 characters,
                                "All (Optimize All Titles)" to optimize all titles, or select a specific item</li>
                            <li>Click the button to optimize titles</li>
                        </ol>
                        <p>This plugin uses AI to optimize titles to be under 70 characters while preserving key words and meaning.</p>
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
                onClick={handleOptimizeTitles}
                disabled={!activeCollection || isProcessing}
            >
                {isProcessing ? 'Processing...' : (
                    selectedItemId === "all"
                        ? 'Optimize Long Titles'
                        : selectedItemId === "rewriteAll"
                            ? 'Optimize All Titles'
                            : 'Optimize Title'
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
