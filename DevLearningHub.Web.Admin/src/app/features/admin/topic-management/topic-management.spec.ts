import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideComponentTestDependencies } from '../../../testing/component-test.providers';
import { TopicManagementComponent } from './topic-management';

describe('TopicManagement', () => {
  let component: TopicManagementComponent;
  let fixture: ComponentFixture<TopicManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopicManagementComponent],
      providers: provideComponentTestDependencies()
    })
    .compileComponents();

    fixture = TestBed.createComponent(TopicManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
