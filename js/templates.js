// Template genérico de tarjeta Bootstrap via JsRender
$.views.templates({
  cardTpl: '<div class="card mb-3 shadow-sm border-0">' +
    '<div class="card-body">' +
    '<h5 class="card-title text-primary">{{:title}}</h5>' +
    '<p class="card-text text-muted">{{:body}}</p>' +
    '</div></div>',

  galleryTpl: '<div class="col-md-4 mb-4">' +
    '<div class="card border-0 shadow-sm">' +
    '<img src="{{:src}}" class="card-img-top" alt="{{:alt}}" style="height:200px;object-fit:cover;">' +
    '<div class="card-footer text-center text-muted small">{{:caption}}</div>' +
    '</div></div>',

  itinerarioTpl: '<tr>' +
    '<td class="fw-bold text-dark">{{:hora}}</td>' +
    '<td>{{:actividad}}</td>' +
    '<td><span class="badge bg-primary">{{:lugar}}</span></td>' +
    '<td class="text-muted">{{:responsable}}</td>' +
    '</tr>'
});