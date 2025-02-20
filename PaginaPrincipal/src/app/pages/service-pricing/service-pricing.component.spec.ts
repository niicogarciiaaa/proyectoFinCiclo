import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ServicePricingComponent } from './service-pricing.component';

describe('ServicePricingComponent', () => {
  let component: ServicePricingComponent;
  let fixture: ComponentFixture<ServicePricingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServicePricingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ServicePricingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
