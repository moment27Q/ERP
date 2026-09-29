import test from 'node:test';
import assert from 'node:assert/strict';
import { extraerErroresCdr } from '../src/config/mifactService.js';

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

const CDR_SUNAT_UBL = `<?xml version="1.0" encoding="UTF-8"?>
<ar:ApplicationResponse xmlns:ar="http://www.sunat.gob.pe/cdr/verGem1.0" version="1.0">
 <ar:Content>
  <cbc:ApplicationResponseCode>2335</cbc:ApplicationResponseCode>
  <cbc:Description>El archivo XML no contiene datos en el nodo DocumentDestination</cbc:Description>
 </ar:Content>
 <ar:Notification>
  <cbc:DocumentReference>R-21507285</cbc:DocumentReference>
  <cbc:ResponseCode>2335</cbc:ResponseCode>
  <sac:Error>
   <cbc:Code>2017</cbc:Code>
   <cbc:Description>El RUC del emisor no esta registrado en SUNAT</cbc:Description>
  </sac:Error>
  <sac:Error>
   <cbc:Code>2027</cbc:Code>
   <cbc:Description>El numero de documento del remitente no cumple el formato</cbc:Description>
   <cbc:ReferenceXPath>/GRE/DespatchAdvice/SenderParty/Party/ID</cbc:ReferenceXPath>
  </sac:Error>
 </ar:Notification>
</ar:ApplicationResponse>`;

const CDR_MIFACT = `<ApplicationResponse>
  <Error><codigo>GRE-014</codigo><numero>1</numero><descripcion>Documento no valido para el tipo</descripcion><campo>num_doc_destinatario</campo></Error>
  <Error><codigo>GRE-021</codigo><numero>2</numero><descripcion>Ubigeo de partida vacio</descripcion><campo>ubigeo_partida</campo></Error>
</ApplicationResponse>`;

const CDR_ACEPTADO = `<ApplicationResponse><Content>
  <ApplicationResponseCode>0</ApplicationResponseCode>
  <Description>La Guia numero V001-1, ha sido aceptada</Description>
</Content></ApplicationResponse>`;

test('extrae errores de un CDR de SUNAT en formato UBL (con namespace)', () => {
  const r = extraerErroresCdr(b64(CDR_SUNAT_UBL));
  assert.equal(r.length, 2);
  assert.equal(r[0].codigo, '2017');
  assert.equal(r[0].descripcion, 'El RUC del emisor no esta registrado en SUNAT');
  assert.equal(r[1].codigo, '2027');
  assert.equal(r[1].campo, '/GRE/DespatchAdvice/SenderParty/Party/ID');
});

test('extrae errores de un CDR de MiFact (etiquetas en espanol sin namespace)', () => {
  const r = extraerErroresCdr(b64(CDR_MIFACT));
  assert.equal(r.length, 2);
  assert.equal(r[0].codigo, 'GRE-014');
  assert.equal(r[0].campo, 'num_doc_destinatario');
  assert.equal(r[1].numero, '2');
});

test('acepta el CDR tanto en base64 como en texto plano', () => {
  assert.deepEqual(extraerErroresCdr(CDR_SUNAT_UBL), extraerErroresCdr(b64(CDR_SUNAT_UBL)));
  assert.deepEqual(extraerErroresCdr(CDR_MIFACT), extraerErroresCdr(b64(CDR_MIFACT)));
});

test('un CDR de aceptacion no produce errores', () => {
  assert.deepEqual(extraerErroresCdr(b64(CDR_ACEPTADO)), []);
});

test('soporta cbc:Observation cuando no hay sac:Error', () => {
  const xml = `<ApplicationResponse><Notification>
    <cbc:Observation>
      <cbc:Code>2027</cbc:Code>
      <cbc:Description>El dato ingresado no cumple con el formato</cbc:Description>
      <cbc:ReferenceXPath>/GRE/DespatchAdvice</cbc:ReferenceXPath>
    </cbc:Observation>
  </Notification></ApplicationResponse>`;
  const r = extraerErroresCdr(b64(xml));
  assert.equal(r.length, 1);
  assert.equal(r[0].codigo, '2027');
});

test('entradas vacias, nulas o no-XML devuelven lista vacia', () => {
  assert.deepEqual(extraerErroresCdr(''), []);
  assert.deepEqual(extraerErroresCdr(null), []);
  assert.deepEqual(extraerErroresCdr(undefined), []);
  assert.deepEqual(extraerErroresCdr('texto plano sin xml'), []);
});

test('ignora entradas invalidas del CDR y numera los errores automaticamente', () => {
  const xml = `<ApplicationResponse>
    <Error><numero>1</numero><descripcion>Solo descripcion, sin codigo</descripcion></Error>
    <Error><codigo>2335</codigo><descripcion>Con codigo</descripcion></Error>
  </ApplicationResponse>`;
  const r = extraerErroresCdr(b64(xml));
  assert.equal(r.length, 2);
  assert.equal(r[0].codigo, '');
  assert.equal(r[0].numero, '1');
  assert.equal(r[1].numero, '2');
});
