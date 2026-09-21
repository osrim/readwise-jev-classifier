/// <reference path="../pocketbase/pb_data/types.d.ts" />

// One record, holding the Readwise pagination cursor. Each "fetch next batch"
// click resumes where the previous one stopped.
migrate(
  (app) => {
    const state = new Collection({
      type: 'base',
      name: 'sync_state',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'source', type: 'text', required: true },
        // Opaque Readwise cursor. Empty means "start from the beginning".
        { name: 'next_cursor', type: 'text', max: 0 },
        // Readwise returned no cursor, so there is nothing left to fetch.
        { name: 'exhausted', type: 'bool' },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_sync_state_source ON sync_state (source)'],
    })
    app.save(state)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('sync_state'))
  },
)
