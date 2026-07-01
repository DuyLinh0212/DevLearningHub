import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

const PROBLEM_TEMPLATES: Record<string, { title: string; difficulty: string; description: string; starterCode: string }> = {
  fibonacci: {
    title: 'Tìm số Fibonacci thứ n',
    difficulty: 'easy',
    description: `## Mô tả bài toán
Viết chương trình tìm số Fibonacci thứ **n** (với $n \\ge 0$).
Dãy Fibonacci được định nghĩa như sau:
- $F(0) = 0$
- $F(1) = 1$
- $F(n) = F(n-1) + F(n-2)$ với $n \\ge 2$.

### Định dạng đầu vào (Input)
- Một số nguyên dương $n$ ($0 \\le n \\le 45$).

### Định dạng đầu ra (Output)
- Số Fibonacci thứ $n$.

### Ví dụ
**Ví dụ 1:**
- Đầu vào: \`5\`
- Đầu ra: \`5\`

**Ví dụ 2:**
- Đầu vào: \`10\`
- Đầu ra: \`55\`

### Ràng buộc (Constraints)
- Thời gian chạy dưới 1s.
- Bộ nhớ dưới 256MB.`,
    starterCode: `#include <iostream>
using namespace std;

// Hàm tính số Fibonacci thứ n
long long fibonacci(int n) {
    // Viết code của bạn ở đây
    return 0;
}

int main() {
    int n;
    if (cin >> n) {
        cout << fibonacci(n) << endl;
    }
    return 0;
}`
  },
  isPrime: {
    title: 'Kiểm tra số nguyên tố',
    difficulty: 'easy',
    description: `## Mô tả bài toán
Viết chương trình kiểm tra xem một số nguyên dương **n** có phải là số nguyên tố hay không.
Số nguyên tố là số tự nhiên lớn hơn 1 và chỉ chia hết cho 1 và chính nó.

### Định dạng đầu vào (Input)
- Một số nguyên dương **n** ($1 \\le n \\le 10^9$).

### Định dạng đầu ra (Output)
- In ra \`YES\` nếu **n** là số nguyên tố, ngược lại in ra \`NO\`.

### Ví dụ
**Ví dụ 1:**
- Đầu vào: \`7\`
- Đầu ra: \`YES\`

**Ví dụ 2:**
- Đầu vào: \`4\`
- Đầu ra: \`NO\`

### Ràng buộc (Constraints)
- Thời gian chạy < 1s.
- Độ phức tạp thuật toán khuyến nghị: $O(\\sqrt{n})$.`,
    starterCode: `#include <iostream>
using namespace std;

bool isPrime(long long n) {
    // Viết code kiểm tra số nguyên tố ở đây
    return false;
}

int main() {
    long long n;
    if (cin >> n) {
        if (isPrime(n)) {
            cout << "YES" << endl;
        } else {
            cout << "NO" << endl;
        }
    }
    return 0;
}`
  },
  twoSum: {
    title: 'Tổng hai số (Two Sum)',
    difficulty: 'easy',
    description: `## Mô tả bài toán
Cho một mảng số nguyên **nums** và một số nguyên **target**. Hãy tìm chỉ số của hai số trong mảng sao cho tổng của chúng bằng **target**.
Bạn có thể giả định rằng mỗi đầu vào sẽ có chính xác một giải pháp và bạn không được sử dụng cùng một phần tử hai lần.
Trả về hai chỉ số cách nhau bởi dấu cách theo thứ tự tăng dần.

### Định dạng đầu vào (Input)
- Dòng đầu chứa số lượng phần tử **n** và số **target** ($2 \\le n \\le 10^4$, $-10^9 \\le target \\le 10^9$).
- Dòng thứ hai chứa **n** số nguyên cách nhau bởi khoảng trắng.

### Định dạng đầu ra (Output)
- Hai chỉ số (0-indexed) của hai phần tử có tổng bằng target.

### Ví dụ
**Ví dụ:**
- Đầu vào:
  \`\`\`text
  4 9
  2 7 11 15
  \`\`\`
- Đầu ra: \`0 1\`

### Ràng buộc (Constraints)
- Thời gian chạy < 1s.
- Bộ nhớ dưới 256MB.`,
    starterCode: `#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

void twoSum(const vector<int>& nums, int target) {
    // Viết code của bạn ở đây
}

int main() {
    int n, target;
    if (cin >> n >> target) {
        vector<int> nums(n);
        for (int i = 0; i < n; i++) {
            cin >> nums[i];
        }
        twoSum(nums, target);
    }
    return 0;
}`
  },
  reverseString: {
    title: 'Đảo ngược chuỗi',
    difficulty: 'easy',
    description: `## Mô tả bài toán
Hãy viết chương trình đảo ngược một chuỗi ký tự cho trước.

### Định dạng đầu vào (Input)
- Một dòng chứa chuỗi ký tự **s** (độ dài không quá 1000 ký tự, có thể chứa khoảng trắng).

### Định dạng đầu ra (Output)
- In ra chuỗi sau khi đã được đảo ngược.

### Ví dụ
- Đầu vào: \`antigravity\`
- Đầu ra: \`ytivargitna\`

### Ràng buộc (Constraints)
- Thời gian chạy dưới 1s.`,
    starterCode: `#include <iostream>
#include <string>
#include <algorithm>
using namespace std;

string reverseString(string s) {
    // Viết code đảo ngược chuỗi ở đây
    return s;
}

int main() {
    string s;
    if (getline(cin, s)) {
        cout << reverseString(s) << endl;
    }
    return 0;
}`
  },
  palindrome: {
    title: 'Kiểm tra chuỗi đối xứng (Palindrome)',
    difficulty: 'easy',
    description: `## Mô tả bài toán
Một chuỗi được gọi là chuỗi đối xứng (Palindrome) nếu đọc từ trái sang phải cũng giống như đọc từ phải sang trái.
Hãy viết chương trình kiểm tra xem một chuỗi cho trước có phải là chuỗi đối xứng hay không.

### Định dạng đầu vào (Input)
- Một dòng chứa chuỗi **s** không chứa khoảng trắng (độ dài không quá 1000 ký tự).

### Định dạng đầu ra (Output)
- In ra \`YES\` nếu chuỗi đối xứng, ngược lại in ra \`NO\`.

### Ví dụ
**Ví dụ 1:**
- Đầu vào: \`abcba\`
- Đầu ra: \`YES\`

**Ví dụ 2:**
- Đầu vào: \`hello\`
- Đầu ra: \`NO\`

### Ràng buộc (Constraints)
- Thời gian chạy < 1s.`,
    starterCode: `#include <iostream>
#include <string>
using namespace std;

bool isPalindrome(const string& s) {
    // Viết code kiểm tra đối xứng ở đây
    return false;
}

int main() {
    string s;
    if (cin >> s) {
        if (isPalindrome(s)) {
            cout << "YES" << endl;
        } else {
            cout << "NO" << endl;
        }
    }
    return 0;
}`
  },
  factorial: {
    title: 'Tính giai thừa của n',
    difficulty: 'easy',
    description: `## Mô tả bài toán
Hãy viết chương trình tính giai thừa của số nguyên dương **n** ($n! = 1 \\cdot 2 \\cdot 3 \\dots n$). Quy ước $0! = 1$.

### Định dạng đầu vào (Input)
- Số nguyên dương **n** ($0 \\le n \\le 20$).

### Định dạng đầu ra (Output)
- Giá trị $n!$.

### Ví dụ
- Đầu vào: \`5\`
- Đầu ra: \`120\`

### Ràng buộc (Constraints)
- Sử dụng kiểu dữ liệu số nguyên lớn (\`long long\` trong C++) để tránh tràn số.
- Thời gian chạy < 1s.`,
    starterCode: `#include <iostream>
using namespace std;

long long factorial(int n) {
    // Viết code tính giai thừa ở đây
    return 1;
}

int main() {
    int n;
    if (cin >> n) {
        cout << factorial(n) << endl;
    }
    return 0;
}`
  },
  fizzBuzz: {
    title: 'Trò chơi FizzBuzz',
    difficulty: 'easy',
    description: `## Mô tả bài toán
Viết chương trình in ra các số từ 1 đến **n**.
Nhưng đối với các số chia hết cho 3 thì in ra \`Fizz\` thay vì số đó.
Đối với các số chia hết cho 5 thì in ra \`Buzz\`.
Đối với các số chia hết cho cả 3 và 5 thì in ra \`FizzBuzz\`.

### Định dạng đầu vào (Input)
- Một số nguyên dương **n** ($1 \\le n \\le 100$).

### Định dạng đầu ra (Output)
- In ra các dòng tương ứng với các số hoặc chữ từ 1 đến **n**.

### Ví dụ
- Đầu vào: \`5\`
- Đầu ra:
  \`\`\`text
  1
  2
  Fizz
  4
  Buzz
  \`\`\``,
    starterCode: `#include <iostream>
using namespace std;

void fizzBuzz(int n) {
    // Viết code xử lý FizzBuzz ở đây
}

int main() {
    int n;
    if (cin >> n) {
        fizzBuzz(n);
    }
    return 0;
}`
  },
  findMaxMin: {
    title: 'Tìm giá trị lớn nhất và nhỏ nhất',
    difficulty: 'easy',
    description: `## Mô tả bài toán
Cho một mảng gồm **n** số nguyên. Hãy tìm giá trị lớn nhất và nhỏ nhất của mảng.

### Định dạng đầu vào (Input)
- Dòng đầu tiên chứa số lượng phần tử **n** ($1 \\le n \\le 10^5$).
- Dòng thứ hai chứa **n** số nguyên cách nhau bởi dấu cách.

### Định dạng đầu ra (Output)
- In ra hai số nguyên cách nhau bởi dấu cách, số đầu tiên là giá trị lớn nhất, số thứ hai là giá trị nhỏ nhất.

### Ví dụ
- Đầu vào:
  \`\`\`text
  5
  3 1 9 4 5
  \`\`\`
- Đầu ra: \`9 1\`

### Ràng buộc (Constraints)
- Thời gian chạy < 1s.`,
    starterCode: `#include <iostream>
#include <vector>
using namespace std;

void findMaxMin(const vector<int>& arr) {
    // Viết code tìm Max và Min ở đây
}

int main() {
    int n;
    if (cin >> n) {
        vector<int> arr(n);
        for (int i = 0; i < n; i++) {
            cin >> arr[i];
        }
        findMaxMin(arr);
    }
    return 0;
}`
  },
  binarySearch: {
    title: 'Tìm kiếm nhị phân',
    difficulty: 'medium',
    description: `## Mô tả bài toán
Cho một mảng số nguyên đã được sắp xếp tăng dần gồm **n** phần tử và một giá trị **x**.
Hãy tìm vị trí (chỉ số bắt đầu từ 0) của **x** trong mảng bằng thuật toán tìm kiếm nhị phân. Nếu không tìm thấy, trả về \`-1\`.

### Định dạng đầu vào (Input)
- Dòng đầu tiên chứa hai số nguyên **n** và **x** ($1 \\le n \\le 10^5$, $-10^9 \\le x \\le 10^9$).
- Dòng thứ hai chứa **n** số nguyên cách nhau bởi dấu cách, đại diện cho các phần tử của mảng.

### Định dạng đầu ra (Output)
- In ra chỉ số của **x** trong mảng (0-indexed) hoặc \`-1\` nếu không tìm thấy.

### Ví dụ
**Ví dụ 1:**
- Đầu vào:
  \`\`\`text
  5 3
  1 2 3 4 5
  \`\`\`
- Đầu ra: \`2\`

**Ví dụ 2:**
- Đầu vào:
  \`\`\`text
  5 6
  1 2 3 4 5
  \`\`\`
- Đầu ra: \`-1\`

### Ràng buộc (Constraints)
- Độ phức tạp thuật toán bắt buộc là $O(\\log n)$.
- Thời gian chạy < 1s.`,
    starterCode: `#include <iostream>
#include <vector>
using namespace std;

// Hàm tìm kiếm nhị phân
int binarySearch(const vector<int>& arr, int x) {
    // Viết code của bạn ở đây
    return -1;
}

int main() {
    int n, x;
    if (cin >> n >> x) {
        vector<int> arr(n);
        for (int i = 0; i < n; i++) {
            cin >> arr[i];
        }
        cout << binarySearch(arr, x) << endl;
    }
    return 0;
}`
  },
  bubbleSort: {
    title: 'Sắp xếp mảng tăng dần (Bubble Sort)',
    difficulty: 'medium',
    description: `## Mô tả bài toán
Cho một mảng số nguyên gồm **n** phần tử. Hãy sắp xếp mảng này theo thứ tự tăng dần bằng thuật toán sắp xếp nổi bọt (Bubble Sort).

### Định dạng đầu vào (Input)
- Dòng đầu tiên chứa số nguyên **n** ($1 \\le n \\le 1000$).
- Dòng thứ hai chứa **n** số nguyên cách nhau bởi khoảng trắng.

### Định dạng đầu ra (Output)
- Dòng duy nhất chứa các số đã được sắp xếp tăng dần, cách nhau bởi khoảng trắng.

### Ví dụ
- Đầu vào:
  \`\`\`text
  5
  5 3 1 4 2
  \`\`\`
- Đầu ra: \`1 2 3 4 5\`

### Ràng buộc (Constraints)
- Thời gian chạy < 1s.`,
    starterCode: `#include <iostream>
#include <vector>
using namespace std;

void bubbleSort(vector<int>& arr) {
    // Viết thuật toán Bubble Sort của bạn ở đây
}

int main() {
    int n;
    if (cin >> n) {
        vector<int> arr(n);
        for (int i = 0; i < n; i++) {
            cin >> arr[i];
        }
        bubbleSort(arr);
        for (int i = 0; i < n; i++) {
            cout << arr[i] << (i == n - 1 ? "" : " ");
        }
        cout << endl;
    }
    return 0;
}`
  },
  gcdLcm: {
    title: 'Tìm UCLN và BCNN',
    difficulty: 'medium',
    description: `## Mô tả bài toán
Tìm ước chung lớn nhất (UCLN) và bội chung nhỏ nhất (BCNN) của hai số nguyên dương **a** và **b**.

### Định dạng đầu vào (Input)
- Một dòng chứa hai số nguyên dương **a** và **b** ($1 \\le a, b \\le 10^9$).

### Định dạng đầu ra (Output)
- In ra hai số nguyên cách nhau bởi dấu cách, số thứ nhất là UCLN, số thứ hai là BCNN.

### Ví dụ
- Đầu vào: \`24 36\`
- Đầu ra: \`12 72\`

### Ràng buộc (Constraints)
- Thời gian chạy < 1s.`,
    starterCode: `#include <iostream>
using namespace std;

long long gcd(long long a, long long b) {
    // Viết code tìm UCLN ở đây
    return 1;
}

long long lcm(long long a, long long b) {
    // Viết code tìm BCNN ở đây
    return 1;
}

int main() {
    long long a, b;
    if (cin >> a >> b) {
        cout << gcd(a, b) << " " << lcm(a, b) << endl;
    }
    return 0;
}`
  },
  validParentheses: {
    title: 'Kiểm tra dãy ngoặc hợp lệ',
    difficulty: 'medium',
    description: `## Mô tả bài toán
Cho một chuỗi **s** chỉ gồm các ký tự ngoặc \`(\`, \`)\`, \`{\`, \`}\`, \`[\`, \`]\`.
Quyết định xem chuỗi đầu vào có hợp lệ hay không. Dãy ngoặc hợp lệ khi:
1. Ngoặc mở phải được đóng bởi cùng loại ngoặc đóng.
2. Ngoặc mở phải được đóng theo đúng thứ tự.

### Định dạng đầu vào (Input)
- Dòng duy nhất chứa chuỗi **s** ($1 \\le s.length \\le 10^4$).

### Định dạng đầu ra (Output)
- In ra \`YES\` nếu dãy ngoặc hợp lệ, ngược lại in ra \`NO\`.

### Ví dụ
**Ví dụ 1:**
- Đầu vào: \`()[]{}\`
- Đầu ra: \`YES\`

**Ví dụ 2:**
- Đầu vào: \`(]\`
- Đầu ra: \`NO\`

### Ràng buộc (Constraints)
- Khuyến nghị sử dụng cấu trúc dữ liệu Ngăn xếp (Stack).
- Thời gian chạy < 1s.`,
    starterCode: `#include <iostream>
#include <string>
#include <stack>
using namespace std;

bool isValid(string s) {
    // Viết code kiểm tra dấu ngoặc hợp lệ ở đây
    return false;
}

int main() {
    string s;
    if (cin >> s) {
        if (isValid(s)) {
            cout << "YES" << endl;
        } else {
            cout << "NO" << endl;
        }
    }
    return 0;
}`
  }
};

@Component({
  selector: 'app-problem-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './problem-management.html',
  styleUrl: './problem-management.css'
})
export class ProblemManagementComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  // ---- Tab ----
  activeTab: 'problems' | 'banks' = 'problems';

  problems: any[] = [];
  filteredProblems: any[] = [];
  topics: any[] = [];
  isLoading = true;

  searchText = '';
  selectedDifficulty = '';
  selectedTopicId = '';

  // ---- Banks ----
  banks: any[] = [];
  filteredBanks: any[] = [];
  banksLoading = false;
  bankSearchText = '';
  bankMinRating = 0;

  isBankModalOpen = false;
  isSavingBank = false;
  editingBankId = '';
  bankForm = { title: '', description: '', isPublic: true };

  showBankDetailModal = false;
  selectedBank: any = null;
  bankDetailLoading = false;
  selectedProblemToAddId = '';
  isAddingProblemToBank = false;

  // Form State
  isModalOpen = false;
  isEditing = false;
  editingProblemId = '';
  form = {
    topicId: '',
    title: '',
    description: '',
    difficulty: 'easy',
    starterCode: ''
  };

  ngOnInit() {
    this.loadTopics();
    this.loadProblems();
    this.loadBanks();
  }

  loadTopics() {
    this.http.get<any>('/api/topics').subscribe({
      next: (res) => {
        const data = res?.data || res;
        this.topics = Array.isArray(data) ? data : [];
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Lỗi tải topics:', err)
    });
  }

  loadProblems() {
    this.isLoading = true;
    this.http.get<any>('/api/problems').subscribe({
      next: (res) => {
        const data = res?.data || res;
        this.problems = Array.isArray(data) ? data : [];
        this.filterProblems();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải danh sách bài tập:', err);
        this.isLoading = false;
        this.problems = [];
        this.filteredProblems = [];
        this.cdr.detectChanges();
      }
    });
  }

  filterProblems() {
    const search = this.searchText.trim().toLowerCase();
    this.filteredProblems = this.problems.filter(p => {
      const matchSearch = !search || p.title?.toLowerCase().includes(search);
      const matchDiff = !this.selectedDifficulty || p.difficulty?.toLowerCase() === this.selectedDifficulty.toLowerCase();
      const matchTopic = !this.selectedTopicId || p.topicId?.toLowerCase() === this.selectedTopicId.toLowerCase();
      return matchSearch && matchDiff && matchTopic;
    });
  }

  openModal(problem: any = null) {
    if (problem) {
      this.isEditing = true;
      this.editingProblemId = problem.id;
      // Get detailed problem info to fetch the description and starter code
      this.isLoading = true;
      this.cdr.detectChanges();
      
      this.http.get<any>(`/api/problems/${problem.id}`).subscribe({
        next: (res) => {
          const detail = res?.data || res;
          this.form = {
            topicId: detail.topicId || '',
            title: detail.title || '',
            description: detail.description || '',
            difficulty: detail.difficulty || 'easy',
            starterCode: detail.starterCode || ''
          };
          this.isModalOpen = true;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.isLoading = false;
          alert('Không thể tải chi tiết bài tập để chỉnh sửa.');
          this.cdr.detectChanges();
        }
      });
    } else {
      this.isEditing = false;
      this.editingProblemId = '';
      this.form = {
        topicId: this.topics[0]?.id || '',
        title: '',
        description: '',
        difficulty: 'easy',
        starterCode: ''
      };
      this.isModalOpen = true;
      this.cdr.detectChanges();
    }
  }

  closeModal() {
    this.isModalOpen = false;
    this.cdr.detectChanges();
  }

  saveProblem() {
    if (!this.form.title.trim() || !this.form.description.trim()) {
      alert('Vui lòng nhập đầy đủ Tên bài tập và Mô tả đề bài.');
      return;
    }

    if (!this.form.topicId) {
      alert('Vui lòng chọn chủ đề cho bài tập.');
      return;
    }

    const rawStarterCode = this.form.starterCode;
    const starterCodeStr: string | null = rawStarterCode
      ? (typeof rawStarterCode === 'string' ? rawStarterCode.trim() : JSON.stringify(rawStarterCode))
      : null;

    const payload = {
      topicId: this.form.topicId,
      title: this.form.title.trim(),
      description: this.form.description.trim(),
      difficulty: this.form.difficulty,
      starterCode: starterCodeStr || null
    };

    if (this.isEditing) {
      // UPDATE existing problem
      this.http.put<any>(`/api/problems/${this.editingProblemId}`, payload).subscribe({
        next: () => {
          alert('Cập nhật bài tập thành công!');
          this.closeModal();
          this.loadProblems();
        },
        error: (err) => {
          console.error('Lỗi cập nhật bài tập:', err);
          alert(err?.error?.message || 'Có lỗi xảy ra khi cập nhật bài tập.');
        }
      });
    } else {
      // CREATE new problem — observe full response to extract Location header
      this.http.post<any>('/api/problems', payload, { observe: 'response' }).subscribe({
        next: (res) => {
          // API returns 201 Created with Location header: /api/problems/{newGuid}
          let newId: string | null = null;
          const location: string = res.headers?.get('Location') || '';
          if (location) {
            const parts = location.split('/');
            newId = parts[parts.length - 1] || null;
          }
          // Fallback: body (in case API changes)
          if (!newId) {
            const body = res.body as any;
            newId = body?.data?.id || body?.id || null;
          }

          this.closeModal();
          if (newId) {
            const goToTC = confirm('Tạo bài tập thành công!\n\nBạn có muốn chuyển sang thiết lập Test Cases cho bài tập này ngay bây giờ không?');
            if (goToTC) {
              this.router.navigate(['/admin/problems', newId, 'test-cases']);
            } else {
              this.loadProblems();
            }
          } else {
            alert('Tạo bài tập thành công! Hãy vào danh sách để thiết lập Test Cases.');
            this.loadProblems();
          }
        },
        error: (err) => {
          console.error('Lỗi tạo bài tập:', err);
          alert(err?.error?.message || 'Có lỗi xảy ra khi tạo bài tập.');
        }
      });
    }
  }

  deleteProblem(id: string) {
    if (!confirm('Bạn có chắc chắn muốn xóa bài tập này? (Xóa mềm, chuyển trạng thái hoạt động về false)')) return;
    this.http.delete<any>(`/api/problems/${id}`).subscribe({
      next: () => {
        alert('Xóa bài tập thành công!');
        this.loadProblems();
      },
      error: (err) => {
        console.error(err);
        alert('Không thể xóa bài tập này.');
      }
    });
  }

  getDifficultyClass(diff: string): string {
    const d = (diff || '').toLowerCase();
    if (d === 'easy') return 'diff-easy';
    if (d === 'medium') return 'diff-medium';
    if (d === 'hard') return 'diff-hard';
    return '';
  }

  getDifficultyLabel(diff: string): string {
    const d = (diff || '').toLowerCase();
    if (d === 'easy') return 'Dễ';
    if (d === 'medium') return 'Trung bình';
    if (d === 'hard') return 'Khó';
    return diff;
  }

  getTopicName(topicId: string): string {
    const topic = this.topics.find(t => t.id.toLowerCase() === topicId.toLowerCase());
    return topic ? topic.name : 'Khác';
  }

  // ---- Banks ----

  loadBanks() {
    this.banksLoading = true;
    this.http.get<any>('/api/problem-banks').subscribe({
      next: (res) => {
        const data = res?.data || res;
        this.banks = Array.isArray(data) ? data : [];
        this.filterBanks();
        this.banksLoading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.banksLoading = false; this.cdr.detectChanges(); }
    });
  }

  filterBanks() {
    const search = this.bankSearchText.trim().toLowerCase();
    this.filteredBanks = this.banks.filter(b => {
      const matchSearch = !search || b.title?.toLowerCase().includes(search) ||
        (b.description || '').toLowerCase().includes(search);
      const matchRating = this.bankMinRating === 0 || (b.avgRating ?? 0) >= this.bankMinRating;
      return matchSearch && matchRating;
    });
  }

  openBankDetail(bank: any) {
    this.bankDetailLoading = true;
    this.showBankDetailModal = true;
    this.selectedBank = null;
    this.selectedProblemToAddId = '';
    this.cdr.detectChanges();
    this.http.get<any>(`/api/problem-banks/${bank.id}`).pipe(
      finalize(() => {
        this.bankDetailLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (res) => {
        const data = res?.data ?? res;
        this.selectedBank = data && typeof data === 'object' ? data : null;
        if (!this.selectedBank) this.showBankDetailModal = false;
      },
      error: () => { this.showBankDetailModal = false; }
    });
  }

  closeBankDetail() {
    this.showBankDetailModal = false;
    this.selectedBank = null;
    this.selectedProblemToAddId = '';
    this.cdr.detectChanges();
  }

  openBankModal(bank?: any) {
    if (bank) {
      this.editingBankId = bank.id;
      this.bankForm = { title: bank.title, description: bank.description || '', isPublic: bank.isPublic };
    } else {
      this.editingBankId = '';
      this.bankForm = { title: '', description: '', isPublic: true };
    }
    this.isBankModalOpen = true;
    this.cdr.detectChanges();
  }

  closeBankModal() {
    if (this.isSavingBank) return;
    this.isBankModalOpen = false;
    this.cdr.detectChanges();
  }

  saveBankForm() {
    if (!this.bankForm.title.trim()) { alert('Vui lòng nhập tên ngân hàng.'); return; }
    this.isSavingBank = true;
    this.cdr.detectChanges();
    const payload = {
      title: this.bankForm.title.trim(),
      description: this.bankForm.description.trim() || null,
      isPublic: this.bankForm.isPublic
    };
    const req = this.editingBankId
      ? this.http.put<any>(`/api/problem-banks/${this.editingBankId}`, payload)
      : this.http.post<any>('/api/problem-banks', payload);
    req.pipe(
      finalize(() => {
        this.isSavingBank = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        this.isBankModalOpen = false;
        this.loadBanks();
      },
      error: (err) => {
        alert(err?.error?.message || 'Không thể lưu ngân hàng.');
      }
    });
  }

  deleteBank(id: string) {
    if (!confirm('Xóa ngân hàng bài tập này?')) return;
    this.http.delete<any>(`/api/problem-banks/${id}`).subscribe({
      next: () => { this.loadBanks(); },
      error: () => alert('Không thể xóa ngân hàng.')
    });
  }

  removeProblemFromBank(bankId: string, problemId: string) {
    if (!confirm('Xóa bài tập này khỏi ngân hàng?')) return;
    this.http.delete<any>(`/api/problem-banks/${bankId}/problems/${problemId}`).subscribe({
      next: () => {
        if (this.selectedBank) {
          this.selectedBank.problems = this.selectedBank.problems.filter((p: any) => p.problemId !== problemId);
          this.selectedBank.problemCount = this.selectedBank.problems.length;
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  getAvailableProblemsForSelectedBank(): any[] {
    if (!this.selectedBank) return [];
    const existingIds = new Set(
      (this.selectedBank.problems || []).map((p: any) => String(p.problemId).toLowerCase())
    );
    return this.problems.filter(p => p?.id && p.isActive !== false && !existingIds.has(String(p.id).toLowerCase()));
  }

  addSelectedProblemToBank() {
    if (!this.selectedBank || !this.selectedProblemToAddId || this.isAddingProblemToBank) return;

    const bankId = this.selectedBank.id;
    const payload = { problemId: this.selectedProblemToAddId };
    this.isAddingProblemToBank = true;
    this.cdr.detectChanges();

    this.http.post<any>(`/api/problem-banks/${bankId}/problems`, payload).pipe(
      finalize(() => {
        this.isAddingProblemToBank = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: () => {
        this.selectedProblemToAddId = '';
        this.loadBanks();
        this.openBankDetail({ id: bankId });
      },
      error: (err) => {
        alert(err?.error?.message || 'Không thể thêm bài tập vào ngân hàng.');
      }
    });
  }

  getDifficultyClassBank(diff: string): string { return this.getDifficultyClass(diff); }
  getDifficultyLabelBank(diff: string): string { return this.getDifficultyLabel(diff); }

  getStars(): number[] { return [1,2,3,4,5]; }

  applyTemplate(templateKey: string) {
    const tpl = PROBLEM_TEMPLATES[templateKey];
    if (tpl) {
      this.form.title = tpl.title;
      this.form.difficulty = tpl.difficulty;
      this.form.description = tpl.description;
      this.form.starterCode = tpl.starterCode;
      this.cdr.detectChanges();
    }
  }

  onSelectLibraryProblem(event: any) {
    const key = event.target?.value;
    if (key) {
      this.applyTemplate(key);
    }
  }
}
