import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiscountsPromotionsComponent } from './discounts-promotions.component';

describe('DiscountsPromotionsComponent', () => {
  let component: DiscountsPromotionsComponent;
  let fixture: ComponentFixture<DiscountsPromotionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiscountsPromotionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DiscountsPromotionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
