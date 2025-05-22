import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InvoiceViewerComponent } from './invoice-viewer.component';

describe('InvoiceViewerComponent', () => {
  let component: InvoiceViewerComponent;
  let fixture: ComponentFixture<InvoiceViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InvoiceViewerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InvoiceViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
