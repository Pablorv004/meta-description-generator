import { useState, useEffect } from "react";
import { framer, Collection } from "framer-plugin";

export function useCollections() {
    const [collections, setCollections] = useState<Collection[]>([]);
    const [activeCollection, setActiveCollection] = useState<Collection | null>(null);

    useEffect(() => {
        const fetchCollections = async () => {
            try {
                const allCollections = await framer.getCollections();
                setCollections(allCollections);

                // Check for active collection
                const active = await framer.getActiveCollection();
                setActiveCollection(active || null);
            } catch (error) {
                console.error(`Error fetching collections: ${error instanceof Error ? error.message : String(error)}`);
            }
        };

        fetchCollections();

        // Set up an interval to check for active collection changes
        const intervalId = setInterval(async () => {
            try {
                const active = await framer.getActiveCollection();
                setActiveCollection(prev => {
                    // Only update if the collection ID actually changed
                    if (!prev || !active || prev.id !== active.id) {
                        return active || null;
                    }
                    return prev;
                });
            } catch (error) {
                console.error(`Error checking active collection: ${error instanceof Error ? error.message : String(error)}`);
            }
        }, 1000);

        return () => clearInterval(intervalId);
    }, []);

    const setCurrentCollection = async (collectionId: string) => {
        try {
            const collection = collections.find(c => c.id === collectionId);
            if (collection) {
                await collection.setAsActive();
                setActiveCollection(collection);
            }
        } catch (error) {
            console.error(`Error setting active collection: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    return { collections, activeCollection, setCurrentCollection };
}
