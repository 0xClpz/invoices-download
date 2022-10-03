import './env'
import axios from 'axios';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import { load } from 'cheerio';
import { writeFile } from 'fs/promises';
import { DateTime } from 'luxon';

const credentials = {
  email: process.env.EMAIL,
  password: process.env.PASSWORD,
};

const period = {
  start: DateTime.fromISO('2022-07-01'),
  end: DateTime.fromISO('2022-09-30')
}

type InvoicesList = {
  count: number;
  results: {
    // invoice id to pass to the invoice details endpoint
    surr_id: string;
    dd_amount: string;
    // YYYY-MM-DD
    invoice_date: string;
  }[];
};

const jar = new CookieJar();
const client = wrapper(
  axios.create({ jar, baseURL: 'https://www.velocityfleet.com' })
);

const getToken = async (): Promise<string> => {
  const { data: loginHtml } = await client.get(`/accounts/login/`);
  const $ = load(loginHtml);
  const csrfToken = $('input[name="csrfmiddlewaretoken"]').val();

  await client({
    method: 'POST',
    url: `/accounts/login/?next=`,
    data: `username=${credentials.email}&password=${credentials.password}&csrfmiddlewaretoken=${csrfToken}`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: 'https://www.velocityfleet.com/',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:104.0) Gecko/20100101 Firefox/104.0',
    },
  });

  const { data: invoicesPageData } = await client.get(`/app/invoices/`);
  return invoicesPageData.split('API_TOKEN: "')[1].split('"')[0];
};

const getInvoices = async (token: string): Promise<InvoicesList> => {
  const { data: invoices } = await client.get<InvoicesList>(
    '/vapi/v1/customers/invoices/',
    {
      params: {
        customer__master_customers: 1350486,
        customer__products: 1,
      },
      headers: {
        Authorization: `TOKEN ${token}`,
      },
    }
  );

  return invoices;
};

const filterInvoices = ({
  start,
  end,
  invoices,
}: {
  start: DateTime;
  end: DateTime;
  invoices: InvoicesList;
}) => {
  return invoices.results.filter((invoice) => {
    const invoiceDate = DateTime.fromISO(invoice.invoice_date);
    return +invoiceDate >= +start && +invoiceDate <= +end;
  });
};

const downloadInvoice = async (invoice: {
  surr_id: string,
  invoice_date: string
}) => {
  const { data: invoiceDetails } = await client.get(
    `vapi/v1/customers/invoices/${invoice.surr_id}/`
  );
  await writeFile(
    `./invoices/${invoice.invoice_date}-${invoice.surr_id}.pdf`,
    new Buffer(invoiceDetails.pdf, 'base64'),
    'binary'
  );
}

const main = async () => {
  const token = await getToken();

  const invoices = await getInvoices(token)

  const invoicesLastQuarter = filterInvoices({...period, invoices });

  for (const invoiceIndex in invoicesLastQuarter) {
    const invoice = invoicesLastQuarter[invoiceIndex];
    console.log(
      `Downloading invoice ${Number(invoiceIndex) + 1}/${invoicesLastQuarter.length}`
    );
    await downloadInvoice(invoice);
  }
};

void main();
