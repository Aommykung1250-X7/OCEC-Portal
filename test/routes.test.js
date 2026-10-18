import assert from 'node:assert/strict';
import test from 'node:test';
import { isKnownSpaLocation, routeFromLocation, routeUrlFor } from '../src/routes.js';

const locationFor = (path) => new URL(path, 'https://portal.example');

test('public and admin deep links resolve to the same pages after a reload', () => {
  const cases = [
    ['/', 'home', ''],
    ['/apply/', 'apply-heat', ''],
    ['/status', 'check-status', ''],
    ['/applications/A%20B/edit', 'edit-application', 'A B'],
    ['/slip-upload/abc', 'slip-upload', 'abc'],
    ['/edit/verify/abc', 'edit-verify', 'abc'],
    ['/portal-admin/dashboard', 'admin-home', ''],
    ['/portal-admin/applications/abc/edit', 'admin-application-edit', 'abc'],
  ];
  for (const [path, page, applicationId] of cases) {
    const location = locationFor(path);
    assert.equal(routeFromLocation(location).page, page, path);
    assert.equal(routeFromLocation(location).applicationId, applicationId, path);
    assert.equal(isKnownSpaLocation(location), true, path);
  }
});

test('unknown and malformed paths resolve to the 404 page', () => {
  for (const path of ['/404', '/missing-page', '/applications/abc/extra', '/slip-upload/abc/extra', '/edit/verify/abc/extra', '/portal-admin/missing-page', '/portal-admin/applications/abc/extra']) {
    const location = locationFor(path);
    assert.equal(routeFromLocation(location).page, 'not-found', path);
    assert.equal(isKnownSpaLocation(location), false, path);
  }
});

test('legacy hash links and dynamic route URLs remain usable', () => {
  assert.deepEqual(routeFromLocation(locationFor('/#apply-heat')), { page: 'apply-heat', applicationId: '', legacy: true });
  assert.deepEqual(routeFromLocation(locationFor('/portal-admin#admin-review')), { page: 'admin-review', applicationId: '', legacy: true });
  assert.equal(routeUrlFor('edit-application', 'A B'), '/applications/A%20B/edit');
  assert.equal(routeUrlFor('admin-review', 'abc'), '/portal-admin/applications/abc');
});
