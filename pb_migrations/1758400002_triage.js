/// <reference path="../pocketbase/pb_data/types.d.ts" />

// The triage page's answer about an article: one verdict and its confidence.
migrate(
  (app) => {
    const articles = app.findCollectionByNameOrId('articles')
    articles.fields.add(
      new JSONField({ name: 'triage', maxSize: 100000 }),
    )
    app.save(articles)
  },
  (app) => {
    const articles = app.findCollectionByNameOrId('articles')
    articles.fields.removeByName('triage')
    app.save(articles)
  },
)
