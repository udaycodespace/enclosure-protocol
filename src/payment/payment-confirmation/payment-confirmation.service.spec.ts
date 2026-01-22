import { Test, TestingModule } from '@nestjs/testing';
import { PaymentConfirmationService } from './payment-confirmation.service';

describe('PaymentConfirmationService', () => {
  let service: PaymentConfirmationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentConfirmationService],
    }).compile();

    service = module.get<PaymentConfirmationService>(PaymentConfirmationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
