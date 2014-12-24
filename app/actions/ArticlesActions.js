var { Promise } = require('bluebird');
var Immutable = require('immutable');
var Reducer = require('reapp-reducer');
var Actions = require('actions');
var API = require('deps/api');

var {
    ArticlesStore,
    HotArticlesStore,
    SavedArticlesStore } = require('../stores');

var loadedReducer = Reducer.bind(null, 'LOADED');
var page = 0;
var per = 10;

Actions.articlesHotLoad.listen(
  opts =>
    API
      .get('topstories.json', opts)
      .then(res => {
        HotArticlesStore(res);
        insertArticles(res);
        Actions.articlesHotLoadDone();
      });
);

Actions.articlesHotLoadMore.listen(
  () =>
    API.get('topstories.json')
      .then(insertNextArticles)
      .then(Actions.articlesHotLoadMoreDone)
);

Actions.articleLoad.listen(
  params => {
    var id = Number(params.id);
    var article = ArticlesStore().get(id);

    if (article && article.get('status') === 'LOADED')
      Actions.articleLoadDone(id);
    else
      API.get(`item/${id}.json`)
        .then(getAllKids)
        .then(loadedReducer)
        .then(insertArticle)
        .then(Actions.articleLoadDone.bind(this, id));
  }
);

Actions.articleSave.listen(
  id => {
    SavedArticlesStore().push(id);
  }
);

function insertArticle(res, rej) {
  if (rej) error(rej);
  if (res) {
    res.map(article => {
      ArticlesStore().set(article.id, Immutable.fromJS(article));
    });
    return res;
  }
}

function insertNextArticles(articles) {
  page = page + 1;
  return insertArticles(articles);
}

function insertArticles(articles) {
  var start = page * per;

  return Promise.all(
    articles.slice(start, start + per).map(
      article => isObject(article) ? article :
        API.get(`item/${article}.json`)
          .then(Reducer)
          .then(insertArticle)
    )
  );
}

function getAllKids(item) {
  var kids = item.kids;
  item.closed = false;

  if (!kids)
    return new Promise(res => res(item));

  return Promise.all(
    kids.map(item => API.get(`item/${item}.json`).then(getAllKids))
  )
  .then(res => {
    item.kids = res;
    item.kidsLoaded = true;
    return item;
  });
}

function error(err) {
  throw err;
}

function isObject(x) {
  return typeof x === 'object';
}