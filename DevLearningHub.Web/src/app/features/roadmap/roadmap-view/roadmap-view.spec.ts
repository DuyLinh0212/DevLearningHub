import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoadmapView } from './roadmap-view';

describe('RoadmapView', () => {
  let component: RoadmapView;
  let fixture: ComponentFixture<RoadmapView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoadmapView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RoadmapView);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
