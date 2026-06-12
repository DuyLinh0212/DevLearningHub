import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionImportComponent } from './question-import';
import { provideComponentTestDependencies } from '../../../testing/component-test.providers';

describe('QuestionImport', () => {
  let component: QuestionImportComponent;
  let fixture: ComponentFixture<QuestionImportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionImportComponent],
      providers: provideComponentTestDependencies()
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuestionImportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
