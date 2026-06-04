import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideComponentTestDependencies } from '../../../testing/component-test.providers';
import { RoadmapViewComponent } from './roadmap-view';

describe('RoadmapView', () => {
  let component: RoadmapViewComponent;
  let fixture: ComponentFixture<RoadmapViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoadmapViewComponent],
      providers: provideComponentTestDependencies()
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoadmapViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
