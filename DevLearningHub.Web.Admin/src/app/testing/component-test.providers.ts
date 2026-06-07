import { EnvironmentProviders, Provider } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

type ComponentTestProviders = Array<Provider | EnvironmentProviders>;

export function provideComponentTestDependencies(options?: {
  routeParams?: Record<string, string>;
  queryParams?: Record<string, string>;
}): ComponentTestProviders {
  const routeParams = options?.routeParams ?? { id: '1' };
  const queryParams = options?.queryParams ?? {};

  return [
    provideRouter([]),
    provideHttpClient(),
    provideHttpClientTesting(),
    {
      provide: ActivatedRoute,
      useValue: {
        snapshot: {
          paramMap: convertToParamMap(routeParams),
          queryParamMap: convertToParamMap(queryParams)
        },
        params: of(routeParams),
        paramMap: of(convertToParamMap(routeParams)),
        queryParams: of(queryParams),
        queryParamMap: of(convertToParamMap(queryParams))
      }
    }
  ];
}
