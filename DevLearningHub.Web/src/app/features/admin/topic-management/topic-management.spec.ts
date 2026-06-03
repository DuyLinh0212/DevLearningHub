import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TopicManagement } from './topic-management';

describe('TopicManagement', () => {
  let component: TopicManagement;
  let fixture: ComponentFixture<TopicManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopicManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TopicManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
