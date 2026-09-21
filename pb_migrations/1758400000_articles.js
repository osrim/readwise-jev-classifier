/// <reference path="../pocketbase/pb_data/types.d.ts" />

// Local POC, no auth: every rule is open.
migrate(
  (app) => {
    const articles = new Collection({
      type: 'base',
      name: 'articles',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'readwise_id', type: 'text', required: true },
        { name: 'title', type: 'text' },
        { name: 'source_url', type: 'text' },
        { name: 'summary', type: 'text', max: 0 },
        { name: 'site_name', type: 'text' },
        { name: 'author', type: 'text' },
        { name: 'saved_at', type: 'text' },
        { name: 'existing_tags', type: 'json', maxSize: 100000 },
        // Keyed by tag id, 0-100. Empty until Jev scores the article.
        { name: 'scores', type: 'json', maxSize: 100000 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_articles_readwise_id ON articles (readwise_id)'],
    })
    app.save(articles)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('articles'))
  },
)
