export async function save(slug, content, config, lastSynced, conflictCallback) {
    try {
        const payload = {
            content: content,
            config: config,
            last_synced: lastSynced
        };

        const res = await fetch(`/api/save/${slug}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if(res.status === 409) {
            const serverData = await res.json();
            conflictCallback(serverData);
            return null;
        }

        if(res.ok) {
            const json = await res.json();
            return json.updated_at;
        }
    } catch (e) {
        console.error(e);
        return null;
    }
}
