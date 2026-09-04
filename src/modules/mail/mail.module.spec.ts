import { MODULE_METADATA } from '@nestjs/common/constants';
import { MailModule } from './mail.module';
import { MailService } from './mail.service';

describe('MailModule', () => {
  it('exports only the enqueue contract', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.EXPORTS, MailModule)).toEqual([
      MailService,
    ]);
  });
});
