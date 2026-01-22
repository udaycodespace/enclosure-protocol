import { Test, TestingModule } from '@nestjs/testing';
import { PaymentFailureService } from './payment-failure.service';

describe('PaymentFailureService', () => {
  let service: PaymentFailureService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentFailureService],
    }).compile();

    service = module.get<PaymentFailureService>(PaymentFailureService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
