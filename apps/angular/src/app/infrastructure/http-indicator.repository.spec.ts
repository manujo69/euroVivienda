import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Catalog, IndicatorData } from '@eurovivienda/contract';
import { HttpIndicatorRepository } from './http-indicator.repository';

describe('HttpIndicatorRepository', () => {
  let repository: HttpIndicatorRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), HttpIndicatorRepository],
    });
    repository = TestBed.inject(HttpIndicatorRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the catalogue from catalog.json', async () => {
    const catalog = [{ id: 'overburden' }] as unknown as Catalog;
    const loading = repository.catalog();
    http.expectOne('catalog.json').flush(catalog);
    expect(await loading).toEqual(catalog);
  });

  it('loads the values of one indicator from data/[id].json', async () => {
    const data: IndicatorData = { ES: { '2024': { total: { v: 7.8 } } } };
    const loading = repository.data('overburden');
    http.expectOne('data/overburden.json').flush(data);
    expect(await loading).toEqual(data);
  });
});
