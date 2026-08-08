import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InvoicesGeneratorComponent } from './invoices-generator.component';

describe('InvoicesGeneratorComponent', () => {
  let component: InvoicesGeneratorComponent;
  let fixture: ComponentFixture<InvoicesGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvoicesGeneratorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InvoicesGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
