import '../css/scrollbars.css';
import WeaveFieldtype from './components/WeaveFieldtype.vue';
import ModalGridFieldtype from './components/ModalGridFieldtype.vue';
import ElasticTextFieldtype from './components/ElasticTextFieldtype.vue';
import ModalAssetsFieldtype from './components/ModalAssetsFieldtype.vue';

Statamic.component('weave-fieldtype', WeaveFieldtype);
Statamic.component('weave-modal-grid-fieldtype', ModalGridFieldtype);
Statamic.component('weave-elastic-text-fieldtype', ElasticTextFieldtype);
Statamic.component('weave-modal-assets-fieldtype', ModalAssetsFieldtype);
