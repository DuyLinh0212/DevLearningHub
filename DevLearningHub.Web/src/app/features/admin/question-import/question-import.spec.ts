import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionImport } from './question-import';

describe('QuestionImport', () => {
  let component: QuestionImport;
  let fixture: ComponentFixture<QuestionImport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuestionImport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(QuestionImport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
